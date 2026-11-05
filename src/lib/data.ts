import "server-only";
import { db } from "./db";
import { followUps } from "./followups";
import type { Ask, EventRow, Message, Opportunity, Person, Task, User } from "./types";

export const TYPE_LABEL: Record<string, string> = {
  job: "Job", internship: "Internship", fellowship: "Fellowship", grad_school: "Grad school",
  scholarship: "Scholarship", research: "Research", program: "Program",
};
export const STAGE_LABEL: Record<string, string> = {
  interested: "Interested", applied: "Applied", assessment: "Assessment", interview: "Interview", offer: "Offer", closed: "Closed",
};
export const OPEN_STAGES = ["interested", "applied", "assessment", "interview", "offer"];

export function listOpportunities(userId: string, opts: { type?: string; includeArchived?: boolean } = {}): Opportunity[] {
  return db
    .prepare(
      `SELECT * FROM opportunities WHERE user_id = ? AND deleted_at IS NULL ${opts.includeArchived ? "" : "AND archived = 0"} ${opts.type ? "AND type = ?" : ""}
       ORDER BY IFNULL(last_activity_at, created_at) DESC`,
    )
    .all(...(opts.type ? [userId, opts.type] : [userId])) as Opportunity[];
}

export function getOpportunity(userId: string, oppId: string) {
  const opp = db.prepare(`SELECT * FROM opportunities WHERE id = ? AND user_id = ? AND deleted_at IS NULL`).get(oppId, userId) as Opportunity | undefined;
  if (!opp) return null;
  const events = db
    .prepare(
      `SELECT e.*, m.thread_id, m.ext_id, m.source, m.subject AS msg_subject, m.from_name, m.from_addr, m.direction
       FROM events e LEFT JOIN messages m ON m.id = e.message_id WHERE e.opportunity_id = ? ORDER BY e.at DESC`,
    )
    .all(oppId) as (EventRow & { thread_id: string | null; ext_id: string | null; source: string | null; msg_subject: string | null; from_name: string | null; from_addr: string | null; direction: string | null })[];
  const tasks = db.prepare(`SELECT * FROM tasks WHERE opportunity_id = ? AND deleted_at IS NULL ORDER BY done, IFNULL(due_at,'9999')`).all(oppId) as Task[];
  const asks = db
    .prepare(`SELECT a.*, p.name AS person_name, p.email AS person_email FROM asks a JOIN people p ON p.id = a.person_id WHERE a.opportunity_id = ? AND p.deleted_at IS NULL ORDER BY a.created_at`)
    .all(oppId) as (Ask & { person_name: string; person_email: string | null })[];
  return { opp, events, tasks, asks };
}

export type TaskRow = Task & { org: string | null; role: string | null };

export function openTasks(userId: string, now = new Date()) {
  return db
    .prepare(
      `SELECT t.*, o.org, o.role FROM tasks t LEFT JOIN opportunities o ON o.id = t.opportunity_id
       WHERE t.user_id = ? AND t.done = 0 AND t.deleted_at IS NULL AND IFNULL(t.snoozed_until, '') <= ?
         AND (o.id IS NULL OR (o.archived = 0 AND o.deleted_at IS NULL AND o.stage != 'closed'))
       ORDER BY IFNULL(t.due_at, '9999'), t.created_at`,
    )
    .all(userId, now.toISOString()) as TaskRow[];
}

export type ReviewItem = Message & { opp_org: string | null; opp_role: string | null; opp_stage: string | null };

export function reviewQueue(userId: string, now = new Date()) {
  return db
    .prepare(
      `SELECT m.*, o.org AS opp_org, o.role AS opp_role, o.stage AS opp_stage FROM messages m
       LEFT JOIN opportunities o ON o.id = m.opportunity_id AND o.deleted_at IS NULL
       WHERE m.user_id = ? AND m.status = 'review' AND IFNULL(m.snoozed_until, '') <= ? ORDER BY m.date DESC LIMIT 100`,
    )
    .all(userId, now.toISOString()) as ReviewItem[];
}

export function reviewCount(userId: string, now = new Date()): number {
  return (db.prepare(`SELECT COUNT(*) n FROM messages WHERE user_id = ? AND status = 'review' AND IFNULL(snoozed_until, '') <= ?`).get(userId, now.toISOString()) as { n: number }).n;
}

export const DORMANT_DAYS = 120;

/** Quiet for staleDays but not yet dormant (older than that is almost certainly a silent rejection). */
export function staleOpportunities(userId: string, staleDays: number, now = new Date()) {
  const cutoff = new Date(now.getTime() - staleDays * 86400_000).toISOString();
  const dormant = new Date(now.getTime() - DORMANT_DAYS * 86400_000).toISOString();
  return db
    .prepare(
      `SELECT * FROM opportunities WHERE user_id = ? AND archived = 0 AND deleted_at IS NULL AND stage IN ('applied','assessment','interview')
         AND IFNULL(last_inbound_at, IFNULL(applied_at, created_at)) < ?
         AND IFNULL(last_activity_at, IFNULL(applied_at, created_at)) >= ?
       ORDER BY IFNULL(last_inbound_at, applied_at) ASC LIMIT 20`,
    )
    .all(userId, cutoff, dormant) as Opportunity[];
}

export function isDormant(o: Opportunity, now = new Date()): boolean {
  if (!["interested", "applied", "assessment", "interview"].includes(o.stage)) return false;
  const last = o.last_activity_at ?? o.applied_at ?? o.created_at;
  return new Date(last).getTime() < now.getTime() - DORMANT_DAYS * 86400_000;
}

export function recentUpdates(userId: string, days = 7, now = new Date()) {
  const since = new Date(now.getTime() - days * 86400_000).toISOString();
  return db
    .prepare(
      `SELECT e.*, o.org, o.role, o.stage FROM events e JOIN opportunities o ON o.id = e.opportunity_id
       WHERE e.user_id = ? AND e.at >= ? AND o.deleted_at IS NULL AND e.kind NOT IN ('outbound','update','note','rejection') ORDER BY e.at DESC LIMIT 20`,
    )
    .all(userId, since) as (EventRow & { org: string; role: string | null; stage: string })[];
}

export function pendingAsks(userId: string) {
  return db
    .prepare(
      `SELECT a.*, p.name AS person_name, o.org FROM asks a JOIN people p ON p.id = a.person_id LEFT JOIN opportunities o ON o.id = a.opportunity_id
       WHERE a.user_id = ? AND a.status IN ('to_ask','asked','agreed') AND p.deleted_at IS NULL ORDER BY IFNULL(a.due_at,'9999'), a.created_at`,
    )
    .all(userId) as (Ask & { person_name: string; org: string | null })[];
}

/** Letters submitted in the last 7 days (for thank-you drafts and the digest). */
export function recentSubmissions(userId: string, now = new Date()) {
  const since = new Date(now.getTime() - 7 * 86400_000).toISOString();
  return db
    .prepare(
      `SELECT a.*, p.name AS person_name, p.email AS person_email, o.org FROM asks a JOIN people p ON p.id = a.person_id
       LEFT JOIN opportunities o ON o.id = a.opportunity_id
       WHERE a.user_id = ? AND a.status = 'submitted' AND IFNULL(a.submitted_at, a.updated_at) >= ? AND p.deleted_at IS NULL`,
    )
    .all(userId, since) as (Ask & { person_name: string; person_email: string | null; org: string | null })[];
}

/** Effort, not outcomes: what you did this week. */
export function effort(userId: string, now = new Date()) {
  const since = new Date(now.getTime() - 7 * 86400_000).toISOString();
  const one = (sql: string) => (db.prepare(sql).get(userId, since) as { n: number }).n;
  return {
    sent: one(`SELECT COUNT(*) n FROM messages WHERE user_id = ? AND direction = 'out' AND date >= ?`),
    applied: one(`SELECT COUNT(*) n FROM opportunities WHERE user_id = ? AND deleted_at IS NULL AND IFNULL(applied_at, created_at) >= ? AND stage != 'interested'`),
    tasksDone: one(`SELECT COUNT(*) n FROM tasks WHERE user_id = ? AND done = 1 AND deleted_at IS NULL AND done_at >= ?`),
    followUpsSent: one(
      `SELECT COUNT(*) n FROM messages m WHERE m.user_id = ? AND m.direction = 'out' AND m.date >= ? AND m.thread_id IS NOT NULL
         AND EXISTS (SELECT 1 FROM messages p WHERE p.user_id = m.user_id AND p.thread_id = m.thread_id AND p.direction = 'out' AND p.date < m.date
           AND NOT EXISTS (SELECT 1 FROM messages q WHERE q.user_id = m.user_id AND q.thread_id = m.thread_id AND q.direction = 'in' AND q.date > p.date AND q.date < m.date))`,
    ),
  };
}

export function today(user: User, now = new Date()) {
  const tasks = openTasks(user.id, now);
  const todayStr = now.toISOString().slice(0, 10);
  const weekStr = new Date(now.getTime() + 7 * 86400_000).toISOString().slice(0, 10);
  const overdue = tasks.filter((t) => t.due_at && t.due_at < todayStr);
  const dueSoon = tasks.filter((t) => t.due_at && t.due_at >= todayStr && t.due_at <= weekStr);
  const upcoming = tasks.filter((t) => !t.due_at || t.due_at > weekStr);
  const followUpsOwed = followUps(user.id, user.followup_days, now);
  const asks = pendingAsks(user.id);
  const stale = staleOpportunities(user.id, user.stale_days, now);
  return {
    overdue,
    dueSoon,
    /** The finite queue: due items first, then follow-ups, then things waiting on others. */
    due: [...overdue, ...dueSoon],
    later: upcoming,
    upcoming,
    followUps: followUpsOwed,
    stale,
    updates: recentUpdates(user.id, 7, now),
    review: reviewCount(user.id, now),
    asks,
    submitted: recentSubmissions(user.id, now),
    effort: effort(user.id, now),
    queueSize: overdue.length + dueSoon.length + followUpsOwed.length,
  };
}

export type PersonRow = Person & {
  asks: (Ask & { org: string | null; role: string | null })[];
  lastContact: string | null;
  contacts: number;
  owes: number;
  dueThisWeek: number;
};

/** Cross-application roster, ranked by how recently and how often you've been in touch. */
export function listPeople(userId: string, now = new Date()): PersonRow[] {
  const people = db.prepare(`SELECT * FROM people WHERE user_id = ? AND deleted_at IS NULL ORDER BY name`).all(userId) as Person[];
  const asks = db
    .prepare(`SELECT a.*, o.org, o.role FROM asks a LEFT JOIN opportunities o ON o.id = a.opportunity_id WHERE a.user_id = ? ORDER BY a.created_at DESC`)
    .all(userId) as (Ask & { org: string | null; role: string | null })[];
  const weekStr = new Date(now.getTime() + 7 * 86400_000).toISOString().slice(0, 10);
  const contact = db.prepare(
    `SELECT MAX(date) AS last, COUNT(*) AS n FROM messages WHERE user_id = ? AND (lower(from_addr) = ? OR lower(to_addrs) LIKE ?)`,
  );
  const rows = people.map((p) => {
    const mine = asks.filter((a) => a.person_id === p.id);
    const c = p.email ? (contact.get(userId, p.email.toLowerCase(), `%${p.email.toLowerCase()}%`) as { last: string | null; n: number }) : { last: null, n: 0 };
    const lastAsk = mine.reduce<string | null>((m, a) => (!m || a.updated_at > m ? a.updated_at : m), null);
    const owing = mine.filter((a) => a.status === "asked" || a.status === "agreed");
    return {
      ...p,
      asks: mine,
      lastContact: [c.last, lastAsk].filter(Boolean).sort().pop() ?? null,
      contacts: c.n + mine.length,
      owes: owing.length,
      dueThisWeek: owing.filter((a) => a.due_at && a.due_at <= weekStr).length,
    };
  });
  const score = (r: PersonRow) => {
    const days = r.lastContact ? (now.getTime() - new Date(r.lastContact).getTime()) / 86400_000 : 365;
    return Math.log2(1 + r.contacts) * 10 - days / 7 + (r.owes ? 50 : 0);
  };
  return rows.sort((a, b) => score(b) - score(a));
}

export function insights(userId: string, now = new Date()) {
  const opps = listOpportunities(userId, { includeArchived: true });
  const byType: Record<string, { total: number; responded: number; interviews: number; offers: number; rejected: number }> = {};
  const months: Record<string, number> = {};
  const firstResponseDays: number[] = [];
  for (const o of opps) {
    const t = (byType[o.type] ??= { total: 0, responded: 0, interviews: 0, offers: 0, rejected: 0 });
    t.total++;
    const reachedInterview = ["interview", "offer"].includes(o.stage);
    if (reachedInterview) t.interviews++;
    if (o.stage === "offer" || o.outcome === "offer") t.offers++;
    if (o.outcome === "rejected") t.rejected++;
    const responded = o.stage !== "applied" && o.stage !== "interested";
    if (responded) t.responded++;
    const started = o.applied_at ?? o.created_at;
    const m = started.slice(0, 7);
    months[m] = (months[m] ?? 0) + 1;
    if (responded && o.applied_at) {
      const first = db
        .prepare(`SELECT MIN(at) AS at FROM events WHERE opportunity_id = ? AND kind IN ('assessment','interview','offer','rejection','info_request') AND at > ?`)
        .get(o.id, o.applied_at) as { at: string | null };
      if (first.at) firstResponseDays.push((new Date(first.at).getTime() - new Date(o.applied_at).getTime()) / 86400_000);
    }
  }
  const series: { month: string; count: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const key = d.toISOString().slice(0, 7);
    series.push({ month: key, count: months[key] ?? 0 });
  }
  const sorted = firstResponseDays.sort((a, b) => a - b);
  const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : null;
  const funnel = {
    applied: opps.filter((o) => o.stage !== "interested").length,
    assessment: opps.filter((o) => ["assessment", "interview", "offer"].includes(o.stage) || (o.stage === "closed" && hasEvent(o.id, ["assessment", "assessment_done", "interview", "offer"]))).length,
    interview: opps.filter((o) => ["interview", "offer"].includes(o.stage) || (o.stage === "closed" && hasEvent(o.id, ["interview", "offer"]))).length,
    offer: opps.filter((o) => o.stage === "offer" || o.outcome === "offer" || o.outcome === "accepted").length,
  };
  // Effort by week: applications started and emails you sent, last 8 weeks.
  const weeks: { week: string; applied: number; sent: number }[] = [];
  for (let i = 7; i >= 0; i--) {
    const end = new Date(now.getTime() - i * 7 * 86400_000);
    const start = new Date(end.getTime() - 7 * 86400_000);
    const [s0, e0] = [start.toISOString(), end.toISOString()];
    weeks.push({
      week: s0.slice(0, 10),
      applied: opps.filter((o) => o.stage !== "interested" && (o.applied_at ?? o.created_at) >= s0 && (o.applied_at ?? o.created_at) < e0).length,
      sent: (db.prepare(`SELECT COUNT(*) n FROM messages WHERE user_id = ? AND direction = 'out' AND date >= ? AND date < ?`).get(userId, s0, e0) as { n: number }).n,
    });
  }
  const answers = db
    .prepare(`SELECT title, uses FROM snippets WHERE user_id = ? AND deleted_at IS NULL AND uses > 0 ORDER BY uses DESC LIMIT 5`)
    .all(userId) as { title: string; uses: number }[];
  return {
    total: opps.length,
    open: opps.filter((o) => OPEN_STAGES.includes(o.stage) && !o.archived).length,
    byType, series, medianDaysToResponse: median, funnel, weeks, answers,
    effort: effort(userId, now),
  };
}

function hasEvent(oppId: string, kinds: string[]): boolean {
  return Boolean(
    db.prepare(`SELECT 1 FROM events WHERE opportunity_id = ? AND kind IN (${kinds.map(() => "?").join(",")}) LIMIT 1`).get(oppId, ...kinds),
  );
}
