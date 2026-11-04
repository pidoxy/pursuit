// End-to-end smoke test + screenshots for Pursuit, using fictional demo data.
// Usage: BASE_URL=http://localhost:3000 INBOUND_SECRET=... node scripts/e2e.mjs [--shots docs/screenshots]
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
// Uses a globally installed Playwright (or npm i -D playwright).
const { chromium, devices } = createRequire(import.meta.url)("playwright");

const BASE = process.env.BASE_URL || "http://localhost:3000";
const SECRET = process.env.INBOUND_SECRET || "testsecret";
const DOMAIN = process.env.INBOUND_DOMAIN || "in.pursuit.test";
const shotsIdx = process.argv.indexOf("--shots");
const SHOTS = shotsIdx > -1 ? process.argv[shotsIdx + 1] : null;
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });

const assert = (cond, msg) => {
  if (!cond) throw new Error(`✗ ${msg}`);
  console.log(`✓ ${msg}`);
};

const demo = execFileSync("node", [new URL("./demo-data.mjs", import.meta.url).pathname]).toString();
const email = `sam+${Date.now()}@example.com`;
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 }, deviceScaleFactor: SHOTS ? 2 : 1 });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const shot = async (name, p = page) => SHOTS && p.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });

await page.goto(BASE);
assert((await page.textContent("h1")).includes("tracked for you"), "landing renders");
await shot("01-landing");

await page.click("text=Get started");
await page.fill("#name", "Sam Rivera");
await page.fill("#email", email);
await page.fill("#password", "correct-horse-battery");
await page.click("button[type=submit]");
await page.waitForURL("**/app/settings**");
assert(await page.isVisible("text=Welcome to Pursuit"), "signup → settings welcome");

// Empty state
await page.goto(`${BASE}/app`);
assert(await page.isVisible("text=Let's build your pipeline"), "empty Today state");

// Import demo email
const res = await page.evaluate(async (body) => {
  const r = await fetch("/api/import", { method: "POST", headers: { "Content-Type": "application/json" }, body });
  return r.json();
}, demo);
assert(res.added === 23, `imported ${res.added} demo emails`);

// Today
await page.goto(`${BASE}/app`);
assert(await page.isVisible("text=Needs you"), "Today renders");
assert(await page.isVisible("text=/Lumen/"), "overdue Lumen video interview surfaced");
assert(await page.isVisible("text=Following up: ML Engineer application"), "follow-up owed detected");
await page.click("text=Draft follow-up");
assert(await page.isVisible("text=Open in Gmail"), "follow-up draft opens");
await shot("02-today");

// Pipeline
await page.goto(`${BASE}/app/pipeline`);
for (const org of ["Orbital AI", "Acme Bank", "Halcyon", "Northwind", "Tessellate"]) {
  assert((await page.locator(`text=${org}`).count()) > 0, `pipeline shows ${org}`);
}
await shot("03-pipeline");

// Opportunity detail: Orbital AI should be at Interview with 2 timeline events
await page.click("text=Orbital AI");
await page.waitForURL("**/app/o/**");
assert((await page.locator("ol[aria-label=Progress] .bg-accent").count()) === 3, "Orbital AI progress at Interview");
assert(await page.isVisible("text=Interview invitation"), "timeline shows interview event");
await page.fill("input[aria-label=Note]", "Recruiter said 3 rounds; panel next.");
await page.click("form >> text=Add");
await page.waitForSelector("text=Recruiter said 3 rounds");
assert(true, "note added to timeline");
await shot("04-opportunity");

// Stage change to offer via select
await page.selectOption("select[aria-label=Stage]", "offer");
await page.waitForTimeout(800);
await page.reload();
assert((await page.locator("ol[aria-label=Progress] .bg-accent").count()) === 4, "manual stage change persisted");

// Add opportunity manually
await page.goto(`${BASE}/app/pipeline`);
await page.click("button:has-text('Add')");
await page.fill("#f-org", "Zephyr Health");
await page.fill("#f-role", "Data Scientist");
await page.selectOption("#f-stage", "interested");
await page.click("button:has-text('Add opportunity')");
await page.waitForURL("**/app/o/**");
assert(await page.isVisible("h1:has-text('Zephyr Health')"), "manual opportunity created");

// People: recommendation + review asks detected automatically
await page.goto(`${BASE}/app/people`);
assert(await page.isVisible("text=Bello"), "recommender auto-tracked");
assert((await page.locator("text=Lumen").count()) > 0, "ask linked to the Lumen opportunity");
await page.locator("button:has-text('→ agreed')").first().click();
await page.waitForTimeout(600);
assert((await page.locator(".chip:has-text('agreed')").count()) > 0, "ask moved to agreed");
await shot("05-people");

// Answers
await page.goto(`${BASE}/app/answers`);
await page.click("button:has-text('New')");
await page.fill("#s-title", "Research pitch (2 sentences)");
await page.fill("#s-body", "I study when retrieval helps or hurts language models in high-stakes domains. My recent paper measures and explains retrieval-induced errors in medical report generation.");
await page.fill("#s-tags", "research, bio");
await page.click("dialog button:has-text('Save')");
await page.waitForSelector("text=Research pitch (2 sentences)");
assert(true, "answer saved");
await shot("06-answers");

// Insights
await page.goto(`${BASE}/app/insights`);
assert(await page.isVisible("text=Applications per month"), "insights render");
await shot("07-insights");

// Forwarding webhook
await page.goto(`${BASE}/app/settings`);
const inbound = (await page.locator("input[readonly]").first().inputValue()).trim();
assert(inbound.endsWith(`@${DOMAIN}`), `forwarding address ${inbound}`);
const fwd = await fetch(`${BASE}/api/inbound/postmark?secret=${SECRET}`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    MessageID: `fwd-${Date.now()}`,
    From: email,
    To: inbound,
    Subject: "Fwd: Your application to Ridgeline",
    Date: new Date().toUTCString(),
    TextBody: "---------- Forwarded message ---------\nFrom: Ridgeline Recruiting <no-reply@hire.lever.co>\nDate: Mon, 2 Nov 2026 at 10:00\nSubject: Your application to Ridgeline\nTo: <me@example.com>\n\nThank you for applying to Ridgeline. We have received your application for the Platform Engineer position.",
  }),
});
assert(fwd.ok && (await fwd.json()).added === 1, "forwarded email ingested");
const bad = await fetch(`${BASE}/api/inbound/postmark?secret=nope`, { method: "POST", body: "{}" });
assert(bad.status === 401, "webhook rejects bad secret");
await page.goto(`${BASE}/app/pipeline`);
assert(await page.isVisible("text=Ridgeline"), "forwarded application appears in pipeline");
await shot("08-settings-pipeline");
await page.goto(`${BASE}/app/settings`);
await shot("08-settings");

// Export
const exp = await page.evaluate(async () => (await fetch("/api/export")).json());
assert(exp.opportunities.length >= 12, `export contains ${exp.opportunities.length} opportunities`);

// Mobile + dark
if (SHOTS) {
  const m = await browser.newContext({ ...devices["iPhone 14"] });
  await m.addCookies(await ctx.cookies());
  const mp = await m.newPage();
  await mp.goto(`${BASE}/app`);
  await mp.screenshot({ path: `${SHOTS}/09-mobile-today.png` });
  await mp.goto(`${BASE}/app/pipeline`);
  await mp.screenshot({ path: `${SHOTS}/10-mobile-pipeline.png` });
  const dk = await browser.newContext({ viewport: { width: 1360, height: 900 }, deviceScaleFactor: 2, colorScheme: "dark" });
  await dk.addCookies(await ctx.cookies());
  const dp = await dk.newPage();
  await dp.goto(`${BASE}/app`);
  await dp.screenshot({ path: `${SHOTS}/11-dark-today.png`, fullPage: true });
}

await ctx.clearCookies();
await page.goto(`${BASE}/app`);
assert(page.url().includes("/login"), "signed-out user redirected to login");
assert(errors.length === 0, `no browser errors${errors.length ? ": " + errors.join("; ") : ""}`);
await browser.close();
console.log("\nAll e2e checks passed.");
