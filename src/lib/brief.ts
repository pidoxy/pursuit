import "server-only";
import { db } from "./db";
import { today } from "./data";
import { sendMail } from "./mailer";
import { zonedParts, zonedDate } from "./time";
import type { User } from "./types";
import { appUrl } from "./urls";

const BRIEF_HOUR = Number(process.env.BRIEF_HOUR ?? 7);
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export async function runBriefs(now = new Date()): Promise<number> {
  const users = db.prepare(`SELECT id, email, name, timezone, inbound_code, followup_days, stale_days, brief_enabled FROM users WHERE brief_enabled = 1`).all() as User[];
  let sent = 0;
  for (const u of users) {
    const p = zonedParts(now, u.timezone);
    if (p.hour < BRIEF_HOUR || p.hour >= BRIEF_HOUR + 3) continue;
    const day = zonedDate(now, u.timezone);
    const t = today(u, now);
    const lines: string[] = [];
    for (const x of t.overdue) lines.push(`Overdue: ${x.title}${x.org ? ` (${x.org})` : ""}`);
    for (const x of t.dueSoon) lines.push(`Due ${x.due_at}: ${x.title}${x.org ? ` (${x.org})` : ""}`);
    for (const f of t.followUps.slice(0, 5)) lines.push(`Follow up: ${f.subject} — ${f.days} days since you wrote to ${f.toName ?? f.to}`);
    for (const e of t.updates.slice(0, 5)) lines.push(`Update: ${e.org} — ${e.summary}`);
    if (!lines.length) continue;
    const claim = db.prepare(`INSERT OR IGNORE INTO briefs_sent (key) VALUES (?)`).run(`${u.id}:${day}`);
    if (!claim.changes) continue;
    await sendMail({
      to: u.email,
      subject: `Pursuit: ${t.overdue.length + t.dueSoon.length} due, ${t.followUps.length} follow-ups`,
      text: `Good morning ${u.name.split(" ")[0]},\n\n${lines.map((l) => `• ${l}`).join("\n")}\n\n${appUrl()}/app`,
      html: `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:auto;padding:24px;color:#12151c">
        <h2 style="margin:0 0 12px">Good morning, ${esc(u.name.split(" ")[0])}</h2>
        <ul style="padding-left:18px;line-height:1.6">${lines.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>
        <p><a href="${appUrl()}/app" style="background:#3447c4;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">Open Pursuit</a></p></div>`,
    });
    sent++;
  }
  return sent;
}
