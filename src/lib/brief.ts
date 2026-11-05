import "server-only";
import { USER_COLS } from "./auth";
import { db } from "./db";
import { today } from "./data";
import { sendMail } from "./mailer";
import { weekdayOf, zonedDate, zonedParts } from "./time";
import type { User } from "./types";
import { appUrl } from "./urls";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const claim = (key: string) => db.prepare(`INSERT OR IGNORE INTO briefs_sent (key) VALUES (?)`).run(key).changes > 0;

export function isPaused(u: Pick<User, "paused_until">, now = new Date()): boolean {
  return Boolean(u.paused_until && u.paused_until > now.toISOString());
}

/** Should the digest go out today, given the cadence? 0 = Sunday. */
export function digestDue(cadence: User["digest_cadence"], dow: number): boolean {
  if (cadence === "weekly") return dow === 1;
  if (cadence === "weekdays") return dow >= 1 && dow <= 5;
  return true;
}

/** "What Pursuit did" in the last 7 days. */
export function weeklyReceipt(userId: string, now = new Date()) {
  const since = new Date(now.getTime() - 7 * 86400_000).toISOString();
  const tracked = (db.prepare(`SELECT COUNT(*) n FROM messages WHERE user_id = ? AND status = 'matched' AND created_at >= ?`).get(userId, since) as { n: number }).n;
  const review = (db.prepare(`SELECT COUNT(*) n FROM messages WHERE user_id = ? AND status = 'review'`).get(userId) as { n: number }).n;
  const tasks = (db.prepare(`SELECT COUNT(*) n FROM tasks WHERE user_id = ? AND created_at >= ? AND deleted_at IS NULL`).get(userId, since) as { n: number }).n;
  return { tracked, review, tasks };
}

export function receiptLine(r: { tracked: number; review: number; tasks: number }): string {
  const parts = [`auto-tracked ${r.tracked} email${r.tracked === 1 ? "" : "s"}`];
  if (r.tasks) parts.push(`added ${r.tasks} deadline${r.tasks === 1 ? "" : "s"}`);
  parts.push(r.review ? `${r.review} waiting for review` : "nothing waiting for review");
  return `This week Pursuit ${parts.join(", ")}.`;
}

function layout(title: string, lines: string[], foot?: string) {
  return `<div style="font-family:Inter,-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:auto;padding:24px;color:#181a22">
    <h2 style="margin:0 0 12px;font-size:20px;font-weight:600">${esc(title)}</h2>
    <ul style="padding-left:18px;line-height:1.6;font-size:14px">${lines.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>
    ${foot ? `<p style="color:#666873;font-size:13px">${esc(foot)}</p>` : ""}
    <p><a href="${appUrl()}/app" style="background:#3e4dc1;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;font-size:14px">Open Pursuit</a></p></div>`;
}

function users(): User[] {
  return db.prepare(`SELECT ${USER_COLS} FROM users u`).all() as User[];
}

/**
 * One digest at the user's hour, on their cadence. Closings never appear: they wait in Review.
 * Follow-ups are suggestions ("you could send"), never a red count.
 */
export async function runBriefs(now = new Date()): Promise<number> {
  let sent = 0;
  for (const u of users()) {
    if (!u.brief_enabled || isPaused(u, now)) continue;
    const p = zonedParts(now, u.timezone);
    if (p.hour < u.digest_hour || p.hour >= u.digest_hour + 3) continue;
    const day = zonedDate(now, u.timezone);
    const dow = weekdayOf(day);
    if (!digestDue(u.digest_cadence, dow)) continue;
    const t = today(u, now);
    const lines: string[] = [];
    for (const x of [...t.overdue, ...t.dueSoon]) lines.push(`Due ${x.due_at}: ${x.title}${x.org ? ` (${x.org})` : ""}`);
    for (const e of t.updates.filter((e) => e.kind !== "rejection").slice(0, 5)) lines.push(`${e.org}: ${e.summary}`);
    for (const f of t.followUps.slice(0, 3)) lines.push(`You could follow up: ${f.subject} (${f.days} days since you wrote)`);
    for (const a of t.submitted) lines.push(`${a.person_name} submitted their letter${a.org ? ` for ${a.org}` : ""}. A thank-you draft is ready.`);
    if (t.review) lines.push(`${t.review} email${t.review === 1 ? "" : "s"} for you to check in Review`);
    const weeklyLine = dow === 1 || u.digest_cadence === "weekly" ? receiptLine(weeklyReceipt(u.id, now)) : undefined;
    if (!lines.length && !weeklyLine) continue;
    if (!claim(`${u.id}:${day}`)) continue;
    const first = u.name.split(" ")[0];
    await sendMail({
      to: u.email,
      subject: `Pursuit: ${lines.length ? `${t.overdue.length + t.dueSoon.length} due, ${t.followUps.length} follow-ups you could send` : "your week"}`,
      text: `Good morning ${first},\n\n${lines.map((l) => `• ${l}`).join("\n")}${weeklyLine ? `\n\n${weeklyLine}` : ""}\n\n${appUrl()}/app`,
      html: layout(`Good morning, ${first}`, lines, weeklyLine),
    });
    sent++;
  }
  return sent;
}

/**
 * Real-time email only for time-critical things: an interview invitation, or a deadline under 48h.
 * Each item alerts once.
 */
export async function runRealtime(now = new Date()): Promise<number> {
  let sent = 0;
  const since = new Date(now.getTime() - 2 * 86400_000).toISOString();
  const soon = new Date(now.getTime() + 2 * 86400_000).toISOString().slice(0, 10);
  const todayStr = now.toISOString().slice(0, 10);
  for (const u of users()) {
    if (!u.realtime_enabled || isPaused(u, now)) continue;
    const interviews = db
      .prepare(
        `SELECT e.id, e.summary, o.org FROM events e JOIN opportunities o ON o.id = e.opportunity_id
         WHERE e.user_id = ? AND e.kind = 'interview' AND e.at >= ? AND o.deleted_at IS NULL`,
      )
      .all(u.id, since) as { id: string; summary: string; org: string }[];
    const deadlines = db
      .prepare(
        `SELECT t.id, t.title, t.due_at, o.org FROM tasks t LEFT JOIN opportunities o ON o.id = t.opportunity_id
         WHERE t.user_id = ? AND t.done = 0 AND t.deleted_at IS NULL AND t.due_at IS NOT NULL AND t.due_at >= ? AND t.due_at <= ?
           AND (o.id IS NULL OR (o.deleted_at IS NULL AND o.stage != 'closed'))`,
      )
      .all(u.id, todayStr, soon) as { id: string; title: string; due_at: string; org: string | null }[];
    const lines: string[] = [];
    for (const i of interviews) if (claim(`rt:${i.id}`)) lines.push(`${i.org}: ${i.summary}`);
    for (const d of deadlines) if (claim(`rt48:${d.id}`)) lines.push(`Due ${d.due_at}: ${d.title}${d.org ? ` (${d.org})` : ""}`);
    if (!lines.length) continue;
    await sendMail({
      to: u.email,
      subject: `Pursuit: ${lines[0]}`,
      text: `${lines.map((l) => `• ${l}`).join("\n")}\n\n${appUrl()}/app`,
      html: layout(lines.length === 1 ? "Needs you soon" : `${lines.length} things need you soon`, lines, "You get these only for interviews and deadlines under 48 hours."),
    });
    sent++;
  }
  return sent;
}

/** TripIt-style receipt for a forwarded email, so the forwarding path never feels like a black hole. */
export async function sendForwardReceipt(userId: string, messageId: string): Promise<void> {
  const u = db.prepare(`SELECT ${USER_COLS} FROM users u WHERE u.id = ?`).get(userId) as User | undefined;
  if (!u || isPaused(u)) return;
  const m = db
    .prepare(`SELECT m.subject, m.status, o.org, o.role, o.stage FROM messages m LEFT JOIN opportunities o ON o.id = m.opportunity_id WHERE m.id = ?`)
    .get(messageId) as { subject: string; status: string; org: string | null; role: string | null; stage: string | null } | undefined;
  if (!m) return;
  const line =
    m.status === "matched" && m.org
      ? `Added to ${m.org}${m.role ? ` · ${m.role}` : ""} (${m.stage}).`
      : m.status === "review"
        ? "Pursuit wasn't sure what this is, so it's waiting for you in Review."
        : m.status === "ignored"
          ? "Skipped, because one of your rules ignores this sender."
          : "This didn't look like an application email, so nothing was added.";
  await sendMail({
    to: u.email,
    subject: `Pursuit got it: ${m.subject.slice(0, 80)}`,
    text: `${line}\n\n${appUrl()}/app`,
    html: layout("Got your forwarded email", [line], `“${m.subject.slice(0, 120)}”`),
  });
}

/** Soft-deleted rows are kept briefly so Undo works, then purged. */
export function purgeDeleted(now = new Date()) {
  const cutoff = new Date(now.getTime() - 86400_000).toISOString();
  for (const t of ["opportunities", "tasks", "people", "snippets"]) {
    db.prepare(`DELETE FROM ${t} WHERE deleted_at IS NOT NULL AND deleted_at < ?`).run(cutoff);
  }
}
