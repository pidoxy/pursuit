// End-to-end smoke test + screenshots for Pursuit, using fictional demo data only.
// Usage: BASE_URL=http://localhost:3000 INBOUND_SECRET=... node scripts/e2e.mjs [--shots docs/screenshots]
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

const email = `sam+${Date.now()}@example.com`;
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 }, deviceScaleFactor: SHOTS ? 2 : 1, reducedMotion: "reduce" });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const shot = async (name, p = page, full = true) => SHOTS && p.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: full });
const toast = (text) => page.locator('[role="status"]').getByText(text).first().waitFor({ timeout: 8000 });

// Landing
await page.goto(BASE);
assert((await page.textContent("h1")).includes("tracked from your inbox"), "landing renders outcome headline");
assert(await page.isVisible("text=Read-only. Pursuit can't send, delete or change your email."), "reassurance under the CTA");
assert((await page.locator("text=Limited Use requirements").count()) > 0, "Limited Use sentence on landing");
await shot("01-landing");

// Signup → onboarding path choice
await page.click("header >> text=Get started");
await page.fill("#name", "Sam Rivera");
await page.fill("#email", email);
await page.fill("#password", "correct-horse-battery");
await page.click("button[type=submit]");
await page.waitForURL("**/app/connect**", { waitUntil: "commit" });
assert(await page.isVisible("text=How should Pursuit find your applications?"), "signup → onboarding path choice");
await shot("02-onboarding");

// Pre-OAuth explainer
await page.click("text=Connect Gmail, read-only");
await page.waitForURL(/step=gmail/, { waitUntil: "commit" });
for (const t of ["What Pursuit reads", "What Pursuit never does", "How to leave"]) assert(await page.isVisible(`text=${t}`), `explainer shows "${t}"`);
await shot("03-connect-explainer");

// Sample-data sandbox → live scan counts
await page.goto(`${BASE}/app/connect`);
await page.click("text=See it with sample data");
await page.waitForURL(/step=scan/, { waitUntil: "commit" });
assert(await page.isVisible("text=/\\d+ applications?, \\d+ interviews?/"), "scan shows live counts");
assert(await page.isVisible("text=Anything it's unsure about goes to Review"), "expectation-setting line");
await shot("04-onboarding-scan");

// Today: a finite queue with keyed actions
await page.goto(`${BASE}/app`);
assert(await page.isVisible("h2:has-text('Due')"), "Today shows the Due group");
assert(await page.isVisible("text=/This week: \\d+ sent/"), "effort line replaces KPI tiles");
assert((await page.locator("text=/Lumen/").count()) > 0, "overdue Lumen video interview surfaced");
assert(await page.isVisible("text=Following up: ML Engineer application"), "follow-up owed detected");
assert(await page.isVisible("text=submitted their letter"), "recommender submission detected from portal email");
await page.click("text=Draft follow-up");
assert(await page.isVisible("text=Open in Gmail"), "follow-up draft opens");
await shot("05-today");

const firstTask = await page.locator("[data-nav-item] p").first().textContent();
await page.locator("body").click({ position: { x: 5, y: 5 } });
await page.keyboard.press("j");
await page.keyboard.press("e");
await toast("Done");
assert(!(await page.locator(`[data-nav-item] p:text-is("${firstTask}")`).count()), "J then E completes the first task");
await page.keyboard.press("z");
await toast("Undone");
await page.waitForTimeout(800);
assert((await page.locator(`text=${firstTask}`).count()) > 0, "Z undoes it");

// Command palette
await page.keyboard.press("Control+k");
await page.fill("[role=combobox]", "Orbital");
await page.waitForSelector("[role=option]:has-text('Orbital AI')");
await shot("06-palette", page, false);
await page.keyboard.press("Enter");
await page.waitForURL("**/app/o/**", { waitUntil: "commit" });
assert(true, "⌘K palette opens an opportunity");

// Opportunity: provenance + Move to…
assert((await page.locator("ol[aria-label=Progress] .bg-accent").count()) === 3, "Orbital AI progress at Interview");
assert(await page.isVisible("text=Detected from email"), "stage carries provenance");
assert((await page.locator("blockquote", { hasText: "invite you to a technical interview" }).count()) > 0, "timeline quotes the source sentence");
await page.fill("input[aria-label=Note]", "Recruiter said 3 rounds; panel next.");
await page.click("form >> text=Add");
await page.waitForSelector("text=Recruiter said 3 rounds");
assert(true, "note added to timeline");
await shot("07-opportunity");
await page.locator("button[aria-label^='Stage:']").first().click();
await page.click("[role=menuitemradio]:has-text('Offer')");
await toast("Moved to Offer");
await page.waitForTimeout(600);
await page.reload();
assert((await page.locator("ol[aria-label=Progress] .bg-accent").count()) === 4, "Move to… menu changed the stage");

// Review: recent closing waits here, in neutral words; E accepts
await page.goto(`${BASE}/app/review`);
assert(await page.isVisible("text=Kestrel Labs isn't moving forward"), "recent closing routed to Review in a neutral sentence");
assert(!(await page.locator("text=/\\d+% sure/").count()), "no confidence percentages");
await shot("08-review");
await page.keyboard.press("e");
await toast("Kestrel Labs");
assert(true, "E accepts the suggestion");

// Pipeline: closed is gray and collapsed; list view; dormant cleanup
await page.goto(`${BASE}/app/pipeline`);
for (const org of ["Orbital AI", "Acme Bank", "Halcyon", "Northwind", "Tessellate"]) {
  assert((await page.locator(`text=${org}`).count()) > 0, `pipeline shows ${org}`);
}
assert(!(await page.locator("text=Rejected").count()), "no red 'Rejected' label anywhere");
await shot("09-pipeline");
await page.goto(`${BASE}/app/pipeline?view=list`);
assert((await page.locator("section[aria-label=Applied]:visible li").count()) > 0, "list view renders rows");
await shot("10-pipeline-list");

// Quick add (C)
await page.goto(`${BASE}/app`);
await page.locator("body").click({ position: { x: 5, y: 5 } });
await page.keyboard.press("c");
await page.fill("[role=combobox]", "Rhodes essay due in 5 days");
await page.keyboard.press("Enter");
await toast("Added");
assert(true, "C quick-adds a dated task");

// Add opportunity manually
await page.goto(`${BASE}/app/pipeline?new=1`);
await page.fill("#f-org", "Zephyr Health");
await page.fill("#f-role", "Data Scientist");
await page.selectOption("#f-stage", "interested");
await page.click("button:has-text('Add opportunity')");
await page.waitForURL("**/app/o/**", { waitUntil: "commit" });
assert(await page.isVisible("h1:has-text('Zephyr Health')"), "manual opportunity created");

// People: roster with portal vocabulary
await page.goto(`${BASE}/app/people`);
assert(await page.isVisible("text=Bello"), "recommender auto-tracked");
assert((await page.locator(".chip:has-text('submitted')").count()) > 0, "Bello's letter marked submitted");
await page.locator("button:has-text('Mark accepted')").first().click();
await toast("Marked accepted");
assert(true, "ask moved to accepted");
await shot("11-people");

// Answers
await page.goto(`${BASE}/app/answers`);
await page.click("button:has-text('New')");
await page.fill("#s-title", "Research pitch (2 sentences)");
await page.fill("#s-body", "I study when retrieval helps or hurts language models in high-stakes domains. My recent paper measures and explains retrieval-induced errors in medical report generation.");
await page.fill("#s-tags", "research, bio");
await page.click("dialog button:has-text('Save')");
await page.waitForSelector("text=Research pitch (2 sentences)");
assert(true, "answer saved");
await shot("12-answers");

// Insights: effort first
await page.goto(`${BASE}/app/insights`);
assert(await page.isVisible("text=Emails you sent"), "insights lead with effort");
assert(await page.isVisible("text=/This week Pursuit auto-tracked/"), "weekly receipt line");
await shot("13-insights");

// Settings: notifications, rules, forwarding
await page.goto(`${BASE}/app/settings`);
assert(await page.isVisible("text=Pause notifications for a week"), "pause notifications available");
await page.fill("#r-match", "hr.employer.example");
await page.click("button:has-text('Ignore')");
await page.waitForSelector("text=hr.employer.example");
assert(true, "ignore rule added");
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
await page.goto(`${BASE}/app/settings`);
await shot("14-settings");

// Shortcut sheet
await page.goto(`${BASE}/app`);
await page.locator("body").click({ position: { x: 5, y: 5 } });
await page.keyboard.press("?");
assert(await page.isVisible("text=Keyboard shortcuts"), "? opens the shortcut sheet");
await page.keyboard.press("Escape");

// Export
const exp = await page.evaluate(async () => (await fetch("/api/export")).json());
assert(exp.opportunities.length >= 12, `export contains ${exp.opportunities.length} opportunities`);

// Mobile + dark
if (SHOTS) {
  const m = await browser.newContext({ ...devices["iPhone 14"], reducedMotion: "reduce" });
  await m.addCookies(await ctx.cookies());
  const mp = await m.newPage();
  await mp.goto(`${BASE}/app`);
  await mp.screenshot({ path: `${SHOTS}/15-mobile-today.png` });
  await mp.goto(`${BASE}/app/pipeline`);
  await mp.screenshot({ path: `${SHOTS}/16-mobile-pipeline.png` });
  const dk = await browser.newContext({ viewport: { width: 1360, height: 900 }, deviceScaleFactor: 2, colorScheme: "dark", reducedMotion: "reduce" });
  await dk.addCookies(await ctx.cookies());
  const dp = await dk.newPage();
  await dp.goto(`${BASE}/app`);
  await dp.screenshot({ path: `${SHOTS}/17-dark-today.png`, fullPage: true });
  await dp.goto(`${BASE}/app/pipeline`);
  await dp.screenshot({ path: `${SHOTS}/18-dark-pipeline.png`, fullPage: true });
}

await ctx.clearCookies();
await page.goto(`${BASE}/app`);
assert(page.url().includes("/login"), "signed-out user redirected to login");
assert(errors.length === 0, `no browser errors${errors.length ? ": " + errors.join("; ") : ""}`);
await browser.close();
console.log("\nAll e2e checks passed.");
