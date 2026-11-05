import "server-only";
import { classify, orgKey, STAGE_RANK, stageForKind, type Classification } from "./classify";
import { db } from "./db";
import { id } from "./ids";
import type { Message, Opportunity, RawEmail, UserRule } from "./types";

const now = () => new Date().toISOString();
const MAX_BODY = 8000;

export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style|head)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr|h[1-6]|table)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n\n")
    .trim();
}

/** Strips quoted replies so classification sees only the new text. */
export function stripQuoted(text: string): string {
  const cut = text.search(/\n\s*(On .{5,120}wrote:|-{2,}\s*Original Message|From: .+\nSent: )/i);
  return (cut > 0 ? text.slice(0, cut) : text).trim();
}

export function addressOf(s: string): string {
  return (s.match(/<([^>]+)>/)?.[1] ?? s).trim().toLowerCase();
}

/** Inserts the email if new. Returns the message id, or null when it already existed. */
export function storeEmail(userId: string, e: RawEmail): string | null {
  const mid = id("msg");
  const res = db
    .prepare(
      `INSERT OR IGNORE INTO messages (id, user_id, source, ext_id, thread_id, direction, from_addr, from_name, to_addrs,
         subject, snippet, body, date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      mid,
      userId,
      e.source,
      e.extId,
      e.threadId,
      e.direction,
      addressOf(e.from),
      e.fromName,
      e.to.slice(0, 1000),
      e.subject.slice(0, 500),
      e.snippet?.slice(0, 500) ?? null,
      e.body.slice(0, MAX_BODY),
      e.date.toISOString(),
    );
  return res.changes ? mid : null;
}

function similarRole(a: string | null, b: string | null): boolean {
  if (!a || !b) return true;
  // "Summer 2026 Analyst" and "Summer 2027 Analyst" are different application cycles.
  const ya = a.match(/\b20\d{2}\b/)?.[0], yb = b.match(/\b20\d{2}\b/)?.[0];
  if (ya && yb && ya !== yb) return false;
  const tok = (s: string) => new Set(s.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2));
  const ta = tok(a), tb = tok(b);
  if (!ta.size || !tb.size) return true;
  let inter = 0;
  for (const w of ta) if (tb.has(w)) inter++;
  return inter / Math.min(ta.size, tb.size) >= 0.5;
}

function findOpportunity(userId: string, msg: Message, c: Classification): Opportunity | null {
  if (msg.thread_id) {
    const viaThread = db
      .prepare(
        `SELECT o.* FROM messages m JOIN opportunities o ON o.id = m.opportunity_id
         WHERE m.user_id = ? AND m.thread_id = ? AND m.opportunity_id IS NOT NULL AND o.deleted_at IS NULL ORDER BY m.date DESC LIMIT 1`,
      )
      .get(userId, msg.thread_id) as Opportunity | undefined;
    if (viaThread) return viaThread;
  }
  if (!c.org) return null;
  const key = orgKey(c.org);
  if (!key) return null;
  const candidates = db
    .prepare(`SELECT * FROM opportunities WHERE user_id = ? AND org_key = ? AND deleted_at IS NULL ORDER BY updated_at DESC`)
    .all(userId, key) as Opportunity[];
  // Prefer an open opportunity with a compatible role; a closed one only if the role clearly matches.
  return (
    candidates.find((o) => o.stage !== "closed" && similarRole(o.role, c.role)) ??
    candidates.find((o) => c.role && o.role && similarRole(o.role, c.role) && o.role.toLowerCase() === c.role.toLowerCase()) ??
    null
  );
}

export function createOpportunity(
  userId: string,
  data: { org: string; role?: string | null; type?: string; stage?: string; applied_at?: string | null; url?: string | null; notes?: string | null; manual?: boolean },
): Opportunity {
  const oid = id("opp");
  db.prepare(
    `INSERT INTO opportunities (id, user_id, org, org_key, role, type, stage, applied_at, last_activity_at, url, notes, manual_stage)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    oid,
    userId,
    data.org,
    orgKey(data.org) || data.org.toLowerCase(),
    data.role ?? null,
    data.type ?? "job",
    data.stage ?? "applied",
    data.applied_at ?? null,
    data.applied_at ?? (data.manual ? now() : null),
    data.url ?? null,
    data.notes ?? null,
    data.manual ? 1 : 0,
  );
  return db.prepare(`SELECT * FROM opportunities WHERE id = ?`).get(oid) as Opportunity;
}

export function addEvent(userId: string, oppId: string, msgId: string | null, kind: string, at: string, summary: string, evidence: string | null = null) {
  const dup = msgId
    ? db.prepare(`SELECT 1 FROM events WHERE opportunity_id = ? AND message_id = ?`).get(oppId, msgId)
    : null;
  if (dup) return;
  db.prepare(`INSERT INTO events (id, user_id, opportunity_id, message_id, kind, at, summary, evidence) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
    id("evt"),
    userId,
    oppId,
    msgId,
    kind,
    at,
    summary.slice(0, 200),
    evidence?.slice(0, 280) ?? null,
  );
}

function addTask(userId: string, oppId: string | null, msgId: string | null, title: string, due: string | null) {
  // One open task per action: repeated reminders for the same thing don't pile up.
  const exists = db
    .prepare(`SELECT 1 FROM tasks WHERE user_id = ? AND IFNULL(opportunity_id,'') = IFNULL(?, '') AND title = ? AND deleted_at IS NULL AND (done = 0 OR IFNULL(due_at,'') = IFNULL(?, ''))`)
    .get(userId, oppId, title, due);
  if (exists) return;
  db.prepare(`INSERT INTO tasks (id, user_id, opportunity_id, message_id, title, due_at) VALUES (?, ?, ?, ?, ?, ?)`).run(
    id("tsk"),
    userId,
    oppId,
    msgId,
    title.slice(0, 200),
    due,
  );
}

/** Close tasks the email shows are already handled. */
function autoComplete(userId: string, oppId: string, msg: Message, c: Classification) {
  const close = (pattern: string) =>
    db.prepare(`UPDATE tasks SET done = 1, done_at = ? WHERE user_id = ? AND opportunity_id = ? AND done = 0 AND title LIKE ? AND created_at <= ?`).run(now(), userId, oppId, pattern, now());
  // You replied in the thread → reply/respond tasks are done.
  if (msg.direction === "out") {
    db.prepare(
      `UPDATE tasks SET done = 1, done_at = ? WHERE user_id = ? AND opportunity_id = ? AND done = 0 AND (title LIKE 'Reply to%' OR title LIKE 'Respond to%')
         AND IFNULL((SELECT date FROM messages WHERE id = tasks.message_id), '') <= ?`,
    ).run(now(), userId, oppId, msg.date);
  }
  if (c.kind === "assessment_done") close("Complete%assessment%");
  if (c.kind === "interview" || c.kind === "offer" || c.kind === "rejection") close("Complete%assessment%");
  if (c.kind === "offer" || c.kind === "rejection") close("Prepare for%interview%");
}

function applyToOpportunity(userId: string, opp: Opportunity, msg: Message, c: Classification) {
  const at = msg.date;
  const updates: string[] = [`last_activity_at = MAX(IFNULL(last_activity_at,''), ?)`, `updated_at = ?`];
  const vals: unknown[] = [at, now()];
  if (msg.direction === "in") {
    updates.push(`last_inbound_at = MAX(IFNULL(last_inbound_at,''), ?)`);
    vals.push(at);
  }
  if (!opp.role && c.role) {
    updates.push(`role = ?`);
    vals.push(c.role);
  }
  if (opp.type === "job" && c.type !== "job") {
    updates.push(`type = ?`);
    vals.push(c.type);
  }
  if (c.kind) {
    const target = stageForKind(c.kind);
    if (c.kind === "received" && !opp.applied_at) {
      updates.push(`applied_at = ?`);
      vals.push(at);
    }
    // Only move forward, and never override a stage you set by hand, unless it's a final outcome
    // that arrived after your edit.
    if (target && !opp.manual_stage) {
      const forward = (STAGE_RANK[target.stage] ?? 0) > (STAGE_RANK[opp.stage] ?? 0);
      const isNewer = !opp.last_inbound_at || at >= opp.last_inbound_at;
      if ((forward || target.outcome) && isNewer) {
        updates.push(`stage = ?`, `outcome = ?`);
        vals.push(target.stage, target.outcome ?? null);
      }
    }
  }
  db.prepare(`UPDATE opportunities SET ${updates.join(", ")} WHERE id = ? AND user_id = ?`).run(...vals, opp.id, userId);
  addEvent(userId, opp.id, msg.id, c.kind ?? "update", at, c.summary || msg.subject, c.evidence ?? null);
  for (const d of c.deadlines) addTask(userId, opp.id, msg.id, d.title, d.due);
  autoComplete(userId, opp.id, msg, c);
  db.prepare(`UPDATE messages SET status = 'matched', opportunity_id = ? WHERE id = ?`).run(opp.id, msg.id);
}

function recordAsk(userId: string, msg: Message, c: Classification) {
  if (!c.ask) return;
  const email = c.ask.personEmail;
  let person = db.prepare(`SELECT id FROM people WHERE user_id = ? AND lower(email) = ?`).get(userId, email) as { id: string } | undefined;
  if (!person) {
    const pid = id("per");
    const fallbackName = email.split("@")[0].replace(/[._]/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
    db.prepare(`INSERT INTO people (id, user_id, name, email, relation) VALUES (?, ?, ?, ?, ?)`).run(
      pid,
      userId,
      c.ask.personName ?? fallbackName,
      email,
      c.ask.kind === "recommendation" ? "Recommender" : c.ask.kind === "review" ? "Reviewer" : "Contact",
    );
    person = { id: pid };
  }
  let oppId: string | null = null;
  if (c.org) {
    const key = orgKey(c.org);
    const match = db
      .prepare(`SELECT id FROM opportunities WHERE user_id = ? AND deleted_at IS NULL AND (org_key = ? OR lower(org) LIKE ? OR lower(IFNULL(role,'')) LIKE ?) ORDER BY updated_at DESC LIMIT 1`)
      .get(userId, key, `%${c.org.toLowerCase()}%`, `%${c.org.toLowerCase()}%`) as { id: string } | undefined;
    oppId = match?.id ?? null;
  }
  if (!oppId) {
    // Subject mentions an opportunity you're tracking ("CaCTüS Internship Application Draft Review").
    const subj = msg.subject.toLowerCase();
    const opps = db.prepare(`SELECT id, org FROM opportunities WHERE user_id = ? AND archived = 0 AND deleted_at IS NULL ORDER BY updated_at DESC`).all(userId) as { id: string; org: string }[];
    const hit = opps.find((o) => {
      const org = o.org.toLowerCase();
      const head = org.split(/\s+/)[0];
      return (org.length >= 3 && subj.includes(org)) || (head.length >= 5 && subj.includes(head));
    });
    oppId = hit?.id ?? null;
  }
  const existing = db
    .prepare(`SELECT id FROM asks WHERE user_id = ? AND person_id = ? AND kind = ? AND IFNULL(opportunity_id,'') = IFNULL(?, '')`)
    .get(userId, person.id, c.ask.kind, oppId);
  if (!existing) {
    db.prepare(`INSERT INTO asks (id, user_id, person_id, opportunity_id, kind, status, notes, created_at) VALUES (?, ?, ?, ?, ?, 'asked', ?, ?)`).run(
      id("ask"),
      userId,
      person.id,
      oppId,
      c.ask.kind,
      msg.subject.slice(0, 200),
      msg.date,
    );
  }
  if (oppId) addEvent(userId, oppId, msg.id, "outbound", msg.date, c.summary);
}

export function userRules(userId: string): UserRule[] {
  return db.prepare(`SELECT * FROM user_rules WHERE user_id = ? ORDER BY created_at`).all(userId) as UserRule[];
}

/** True when a rule says to skip this sender. Rules are narrow by default: one sender, or one domain. */
export function ignoredByRule(rules: UserRule[], fromAddr: string): boolean {
  const addr = fromAddr.toLowerCase();
  const domain = addr.split("@")[1] ?? "";
  return rules.some(
    (r) =>
      (r.kind === "ignore_sender" && r.match === addr) ||
      (r.kind === "ignore_domain" && (domain === r.match || domain.endsWith(`.${r.match}`))),
  );
}

function applyAliases(rules: UserRule[], c: Classification): Classification {
  if (!c.org) return c;
  const key = orgKey(c.org);
  const alias = rules.find((r) => r.kind === "org_alias" && r.match === key && r.value);
  return alias ? { ...c, org: alias.value } : c;
}

/** Recent closings go to Review (calm, user-confirmed); old ones from a backfill apply directly. */
export const REVIEW_CLOSINGS_DAYS = 14;

/** A portal says a recommender submitted: mark the matching open ask as submitted. */
function recordSubmission(userId: string, msg: Message, c: Classification): boolean {
  const text = `${msg.subject}\n${msg.body ?? ""}`.toLowerCase();
  const open = db
    .prepare(
      `SELECT a.id, a.opportunity_id, p.name, p.email FROM asks a JOIN people p ON p.id = a.person_id
       WHERE a.user_id = ? AND a.status IN ('to_ask','asked','agreed') AND p.deleted_at IS NULL ORDER BY a.created_at DESC`,
    )
    .all(userId) as { id: string; opportunity_id: string | null; name: string; email: string | null }[];
  const hit = open.find((a) => {
    if (a.email && msg.from_addr === a.email.toLowerCase()) return true;
    const parts = a.name.toLowerCase().split(/\s+/).filter((w) => w.length >= 3 && !/^(dr|prof|mr|mrs|ms)\.?$/.test(w));
    const last = parts[parts.length - 1];
    return Boolean(last && text.includes(last));
  });
  if (!hit) return false;
  db.prepare(`UPDATE asks SET status = 'submitted', submitted_at = ?, updated_at = ? WHERE id = ?`).run(msg.date, now(), hit.id);
  if (hit.opportunity_id) {
    addEvent(userId, hit.opportunity_id, msg.id, "update", msg.date, `${hit.name} submitted their letter`, c.evidence ?? null);
    db.prepare(`UPDATE messages SET status = 'matched', opportunity_id = ? WHERE id = ?`).run(hit.opportunity_id, msg.id);
  } else {
    db.prepare(`UPDATE messages SET status = 'matched' WHERE id = ?`).run(msg.id);
  }
  return true;
}

/** Classifies a stored message and applies it. Safe to re-run. */
export async function processMessage(userId: string, msgId: string, opts: { now?: Date } = {}): Promise<void> {
  const msg = db.prepare(`SELECT * FROM messages WHERE id = ? AND user_id = ?`).get(msgId, userId) as Message | undefined;
  if (!msg || msg.status === "ignored") return;
  const rules = userRules(userId);
  if (msg.direction === "in" && ignoredByRule(rules, msg.from_addr)) {
    db.prepare(`UPDATE messages SET status = 'ignored' WHERE id = ?`).run(msg.id);
    return;
  }
  const body = stripQuoted(msg.body ?? msg.snippet ?? "");
  const raw = await classify({
    from: msg.from_addr,
    fromName: msg.from_name,
    to: msg.to_addrs,
    subject: msg.subject,
    body,
    date: new Date(msg.date),
    direction: msg.direction,
  });
  const c = applyAliases(rules, raw);
  db.prepare(`UPDATE messages SET classification = ? WHERE id = ?`).run(JSON.stringify(c), msg.id);
  const nowMs = (opts.now ?? new Date()).getTime();

  db.transaction(() => {
    if (msg.direction === "out") {
      recordAsk(userId, msg, c);
      // Outbound mail in a tracked thread becomes part of that opportunity's timeline.
      const opp = msg.thread_id ? findOpportunity(userId, msg, { ...c, org: null }) : null;
      if (opp) applyToOpportunity(userId, opp, msg, { ...c, kind: null, summary: c.summary || `You replied: ${msg.subject}` });
      else db.prepare(`UPDATE messages SET status = 'irrelevant' WHERE id = ?`).run(msg.id);
      return;
    }
    if (c.recSubmitted && recordSubmission(userId, msg, c)) return;
    if (!c.relevant) {
      // Inbound replies in a tracked thread still belong to it.
      const viaThread = msg.thread_id ? findOpportunity(userId, msg, { ...c, org: null }) : null;
      if (viaThread) applyToOpportunity(userId, viaThread, msg, { ...c, kind: c.kind ?? "update", summary: c.summary || `Reply: ${msg.subject}` });
      else db.prepare(`UPDATE messages SET status = 'irrelevant' WHERE id = ?`).run(msg.id);
      return;
    }
    let opp = findOpportunity(userId, msg, c);
    if (c.kind === "rejection" && nowMs - new Date(msg.date).getTime() <= REVIEW_CLOSINGS_DAYS * 86400_000) {
      // Never close something on the user's behalf in real time: suggest it in Review.
      db.prepare(`UPDATE messages SET status = 'review', opportunity_id = ? WHERE id = ?`).run(opp?.id ?? null, msg.id);
      if (opp) db.prepare(`UPDATE opportunities SET last_inbound_at = MAX(IFNULL(last_inbound_at,''), ?) WHERE id = ?`).run(msg.date, opp.id);
      return;
    }
    const creatable = c.org && c.kind && c.kind !== "update" && c.kind !== "info_request" && c.confidence >= 0.6;
    if (!opp && creatable) {
      opp = createOpportunity(userId, {
        org: c.org!,
        role: c.role,
        type: c.type,
        stage: "applied",
        applied_at: c.kind === "received" ? msg.date : null,
      });
    }
    if (opp && (c.confidence >= 0.6 || msg.thread_id)) applyToOpportunity(userId, opp, msg, c);
    else db.prepare(`UPDATE messages SET status = 'review', opportunity_id = ? WHERE id = ?`).run(opp?.id ?? null, msg.id);
  })();
}

/** Stores and processes a batch of emails, oldest first so stages progress in order. */
export async function ingest(userId: string, emails: RawEmail[], opts: { now?: Date } = {}): Promise<{ added: number; messageIds: string[] }> {
  const sorted = [...emails].sort((a, b) => a.date.getTime() - b.date.getTime());
  let added = 0;
  const messageIds: string[] = [];
  for (const e of sorted) {
    const mid = storeEmail(userId, e);
    if (!mid) continue;
    added++;
    messageIds.push(mid);
    await processMessage(userId, mid, opts);
  }
  return { added, messageIds };
}

/** Manually attach a review-queue message to an opportunity (existing or new). */
export function assignMessage(userId: string, msgId: string, oppId: string) {
  const msg = db.prepare(`SELECT * FROM messages WHERE id = ? AND user_id = ?`).get(msgId, userId) as Message | undefined;
  const opp = db.prepare(`SELECT * FROM opportunities WHERE id = ? AND user_id = ? AND deleted_at IS NULL`).get(oppId, userId) as Opportunity | undefined;
  if (!msg || !opp) return;
  const c: Classification = msg.classification
    ? JSON.parse(msg.classification)
    : { relevant: true, confidence: 1, kind: "update", org: opp.org, role: opp.role, type: opp.type as Classification["type"], deadlines: [], ask: null, summary: msg.subject, extractor: "manual" };
  applyToOpportunity(userId, opp, msg, { ...c, confidence: 1 });
}
