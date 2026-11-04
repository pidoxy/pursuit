import "server-only";
import { db } from "./db";
import type { Message } from "./types";

const AUTOMATED = /(no-?reply|do-?not-?reply|notifications?|mailer|bounce|support@|info@|hello@|team@|recruiting@|careers@|jobs@)/i;
// Short closers that don't expect an answer.
const CLOSER = /^(thanks|thank you|many thanks|sounds good|great|noted|ok(ay)?|will do|appreciate|perfect|awesome|got it|cool)\b/i;

export interface FollowUp {
  threadId: string;
  subject: string;
  to: string;
  toName: string | null;
  lastSentAt: string;
  days: number;
  opportunityId: string | null;
  org: string | null;
  messageId: string;
}

function firstRecipient(to: string): { addr: string; name: string | null } {
  const first = to.split(",")[0]?.trim() ?? "";
  const m = first.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>/);
  return m ? { addr: m[2].toLowerCase(), name: m[1].trim() || null } : { addr: first.toLowerCase(), name: null };
}

export function followUps(userId: string, thresholdDays: number, now = new Date()): FollowUp[] {
  const user = db.prepare(`SELECT email FROM users WHERE id = ?`).get(userId) as { email: string } | undefined;
  const gmail = db.prepare(`SELECT email FROM google_accounts WHERE user_id = ?`).get(userId) as { email: string } | undefined;
  const mine = new Set([user?.email, gmail?.email].filter(Boolean).map((s) => s!.toLowerCase()));
  const cutoff = new Date(now.getTime() - thresholdDays * 86400_000).toISOString();
  const floor = new Date(now.getTime() - 60 * 86400_000).toISOString();

  // Latest message per thread where the latest is outbound.
  const rows = db
    .prepare(
      `SELECT m.* FROM messages m
       JOIN (SELECT thread_id, MAX(date) AS d FROM messages WHERE user_id = ? AND thread_id IS NOT NULL GROUP BY thread_id) t
         ON t.thread_id = m.thread_id AND t.d = m.date
       WHERE m.user_id = ? AND m.direction = 'out' AND m.date <= ? AND m.date >= ?
       ORDER BY m.date ASC`,
    )
    .all(userId, userId, cutoff, floor) as Message[];

  const states = new Map(
    (db.prepare(`SELECT thread_id, state, until FROM followup_state WHERE user_id = ?`).all(userId) as { thread_id: string; state: string; until: string | null }[]).map(
      (r) => [r.thread_id, r],
    ),
  );

  const out: FollowUp[] = [];
  for (const m of rows) {
    const st = states.get(m.thread_id!);
    if (st?.state === "dismissed") continue;
    if (st?.state === "snoozed" && st.until && st.until > now.toISOString()) continue;
    const rcpt = firstRecipient(m.to_addrs);
    if (!rcpt.addr || mine.has(rcpt.addr) || AUTOMATED.test(rcpt.addr)) continue;
    const text = (m.body ?? m.snippet ?? "").replace(/^(hi|hello|dear)[^\n,]*,?\s*/i, "").trim();
    if (text.length < 280 && CLOSER.test(text)) continue;
    const opp = m.opportunity_id
      ? (db.prepare(`SELECT org FROM opportunities WHERE id = ?`).get(m.opportunity_id) as { org: string } | undefined)
      : undefined;
    out.push({
      threadId: m.thread_id!,
      subject: m.subject.replace(/^(re|fwd?):\s*/gi, ""),
      to: rcpt.addr,
      toName: rcpt.name,
      lastSentAt: m.date,
      days: Math.floor((now.getTime() - new Date(m.date).getTime()) / 86400_000),
      opportunityId: m.opportunity_id,
      org: opp?.org ?? null,
      messageId: m.id,
    });
  }
  return out.sort((a, b) => b.days - a.days);
}

export function draftFollowUp(f: FollowUp, senderName: string): { subject: string; body: string } {
  const first = f.toName?.split(" ")[0] ?? "there";
  const subject = f.subject.toLowerCase().startsWith("re:") ? f.subject : `Re: ${f.subject}`;
  const when = f.days >= 14 ? `a couple of weeks ago` : `last week`;
  const body = `Hi ${first},

I hope you're doing well. I wanted to follow up on my email from ${when} about "${f.subject}". I'd be grateful for any update when you have a moment, and I'm happy to share anything else that would help.

Thank you for your time.

Best regards,
${senderName}`;
  return { subject, body };
}

export function gmailComposeUrl(to: string, subject: string, body: string): string {
  const p = new URLSearchParams({ view: "cm", fs: "1", to, su: subject, body });
  return `https://mail.google.com/mail/?${p}`;
}
