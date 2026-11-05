"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { destroySession, requireUser } from "@/lib/auth";
import { orgKey, STAGES } from "@/lib/classify/rules";
import { db } from "@/lib/db";
import { disconnect, disconnectAndDelete } from "@/lib/gmail";
import { id, token } from "@/lib/ids";
import * as chrono from "chrono-node";
import { demoMessages } from "@/lib/demo";
import { addressOf, assignMessage, createOpportunity, ingest, processMessage } from "@/lib/ingest";
import { isValidTimeZone } from "@/lib/time";
import type { Message, RawEmail } from "@/lib/types";
import type { OppSnapshot, RulePrompt, Undoable, UndoOp } from "@/lib/undo";

export type FormState = { error?: string; ok?: boolean; id?: string; prompt?: RulePrompt } | undefined;

const nowIso = () => new Date().toISOString();
const SNAP_COLS = "id, stage, outcome, manual_stage, archived, role, type, applied_at, last_activity_at, last_inbound_at";
function snapOpp(userId: string, oppId: string): OppSnapshot | null {
  return (db.prepare(`SELECT ${SNAP_COLS} FROM opportunities WHERE id = ? AND user_id = ?`).get(oppId, userId) as OppSnapshot | undefined) ?? null;
}
function restoreOpp(userId: string, s: OppSnapshot) {
  db.prepare(
    `UPDATE opportunities SET stage = ?, outcome = ?, manual_stage = ?, archived = ?, role = ?, type = ?, applied_at = ?, last_activity_at = ?, last_inbound_at = ?,
       updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ? AND user_id = ?`,
  ).run(s.stage, s.outcome, s.manual_stage, s.archived, s.role, s.type, s.applied_at, s.last_activity_at, s.last_inbound_at, s.id, userId);
}
const STAGE_NAME: Record<string, string> = { interested: "Interested", applied: "Applied", assessment: "Assessment", interview: "Interview", offer: "Offer", closed: "Closed" };

const refresh = () => revalidatePath("/app", "layout");
const str = (f: FormData, k: string, max = 200) => String(f.get(k) ?? "").trim().slice(0, max);
const TYPES = ["job", "internship", "fellowship", "grad_school", "scholarship", "research", "program"];

// ───────── opportunities ─────────

export async function saveOpportunity(_prev: FormState, f: FormData): Promise<FormState> {
  const user = await requireUser();
  const org = str(f, "org", 80);
  if (!org) return { error: "Add the organisation name." };
  const type = TYPES.includes(str(f, "type")) ? str(f, "type") : "job";
  const stage = (STAGES as readonly string[]).includes(str(f, "stage")) ? str(f, "stage") : "applied";
  const fields = {
    org,
    role: str(f, "role", 120) || null,
    type,
    stage,
    url: str(f, "url", 500) || null,
    location: str(f, "location", 80) || null,
    notes: str(f, "notes", 4000) || null,
    applied_at: str(f, "applied_at") ? new Date(str(f, "applied_at")).toISOString() : null,
  };
  const oppId = str(f, "id");
  if (oppId) {
    const before = db.prepare(`SELECT org FROM opportunities WHERE id = ? AND user_id = ?`).get(oppId, user.id) as { org: string } | undefined;
    db.prepare(
      `UPDATE opportunities SET org = ?, org_key = ?, role = ?, type = ?, stage = ?, url = ?, location = ?, notes = ?, applied_at = ?, confirmed = 1,
         manual_stage = CASE WHEN stage != ? THEN 1 ELSE manual_stage END,
         outcome = CASE WHEN ? != 'closed' THEN NULL ELSE outcome END,
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
       WHERE id = ? AND user_id = ?`,
    ).run(fields.org, orgKey(fields.org) || fields.org.toLowerCase(), fields.role, fields.type, fields.stage, fields.url, fields.location, fields.notes, fields.applied_at, fields.stage, fields.stage, oppId, user.id);
    refresh();
    const fromKey = before ? orgKey(before.org) : "";
    if (before && fromKey && fromKey !== orgKey(fields.org)) {
      return { ok: true, id: oppId, prompt: { kind: "org_alias", match: fromKey, value: fields.org, label: `Use “${fields.org}” for future emails that say “${before.org}”?` } };
    }
    return { ok: true, id: oppId };
  }
  const opp = createOpportunity(user.id, { ...fields, manual: true });
  refresh();
  return { ok: true, id: opp.id };
}

export async function setStage(oppId: string, stage: string, outcome?: string | null): Promise<Undoable> {
  const user = await requireUser();
  if (!(STAGES as readonly string[]).includes(stage)) return { error: "Unknown stage" };
  const snap = snapOpp(user.id, oppId);
  if (!snap) return { error: "Not found" };
  db.prepare(
    `UPDATE opportunities SET stage = ?, outcome = ?, manual_stage = 1, confirmed = 1, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ? AND user_id = ?`,
  ).run(stage, stage === "closed" ? (outcome ?? "withdrawn") : null, oppId, user.id);
  refresh();
  return { message: `Moved to ${STAGE_NAME[stage]}`, undo: { op: "opp", snap: [snap] } };
}

export async function confirmOpportunity(oppId: string): Promise<Undoable> {
  const user = await requireUser();
  db.prepare(`UPDATE opportunities SET confirmed = 1 WHERE id = ? AND user_id = ?`).run(oppId, user.id);
  refresh();
  return { message: "Details confirmed" };
}

export async function archiveOpportunity(oppId: string, archived: boolean): Promise<Undoable> {
  const user = await requireUser();
  const snap = snapOpp(user.id, oppId);
  if (!snap) return { error: "Not found" };
  db.prepare(`UPDATE opportunities SET archived = ? WHERE id = ? AND user_id = ?`).run(archived ? 1 : 0, oppId, user.id);
  refresh();
  return { message: archived ? "Archived" : "Restored", undo: { op: "opp", snap: [snap] } };
}

/** Soft delete: the row stays for a day so Undo works, then the scheduler purges it. */
export async function deleteOpportunity(oppId: string): Promise<Undoable> {
  const user = await requireUser();
  const r = db.prepare(`UPDATE opportunities SET deleted_at = ? WHERE id = ? AND user_id = ? AND deleted_at IS NULL`).run(nowIso(), oppId, user.id);
  if (!r.changes) return { error: "Not found" };
  refresh();
  return { message: "Opportunity deleted", undo: { op: "restore", table: "opportunities", id: oppId } };
}

/** Get-to-zero: everything quiet for 60+ days becomes Closed · Dormant in one go. */
export async function markStaleDormant(days = 60): Promise<Undoable> {
  const user = await requireUser();
  const cutoff = new Date(Date.now() - days * 86400_000).toISOString();
  const rows = db
    .prepare(
      `SELECT ${SNAP_COLS} FROM opportunities WHERE user_id = ? AND deleted_at IS NULL AND archived = 0 AND stage IN ('interested','applied','assessment','interview')
         AND IFNULL(last_activity_at, IFNULL(applied_at, created_at)) < ?`,
    )
    .all(user.id, cutoff) as OppSnapshot[];
  if (!rows.length) return { message: `Nothing has been quiet for ${days}+ days` };
  const upd = db.prepare(`UPDATE opportunities SET stage = 'closed', outcome = 'dormant', manual_stage = 1, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ? AND user_id = ?`);
  db.transaction(() => rows.forEach((r) => upd.run(r.id, user.id)))();
  refresh();
  return { message: `Marked ${rows.length} quiet application${rows.length === 1 ? "" : "s"} as dormant`, undo: { op: "opp", snap: rows } };
}

export async function addNote(oppId: string, text: string) {
  const user = await requireUser();
  const t = text.trim().slice(0, 1000);
  if (!t) return;
  db.prepare(`INSERT INTO events (id, user_id, opportunity_id, kind, at, summary) VALUES (?, ?, ?, 'note', ?, ?)`).run(
    id("evt"), user.id, oppId, new Date().toISOString(), t,
  );
  refresh();
}

// ───────── tasks ─────────

export async function toggleTask(taskId: string, done: boolean): Promise<Undoable> {
  const user = await requireUser();
  const prev = db.prepare(`SELECT id, done, done_at, snoozed_until FROM tasks WHERE id = ? AND user_id = ?`).get(taskId, user.id) as
    | { id: string; done: number; done_at: string | null; snoozed_until: string | null }
    | undefined;
  if (!prev) return { error: "Not found" };
  db.prepare(`UPDATE tasks SET done = ?, done_at = ? WHERE id = ? AND user_id = ?`).run(done ? 1 : 0, done ? nowIso() : null, taskId, user.id);
  refresh();
  return { message: done ? "Done" : "Reopened", undo: { op: "task", ...prev } };
}

export async function snoozeTask(taskId: string, days = 1): Promise<Undoable> {
  const user = await requireUser();
  const prev = db.prepare(`SELECT id, done, done_at, snoozed_until FROM tasks WHERE id = ? AND user_id = ?`).get(taskId, user.id) as
    | { id: string; done: number; done_at: string | null; snoozed_until: string | null }
    | undefined;
  if (!prev) return { error: "Not found" };
  db.prepare(`UPDATE tasks SET snoozed_until = ? WHERE id = ? AND user_id = ?`).run(new Date(Date.now() + days * 86400_000).toISOString(), taskId, user.id);
  refresh();
  return { message: days === 1 ? "Snoozed until tomorrow" : `Snoozed for ${days} days`, undo: { op: "task", ...prev } };
}

export async function setTaskDue(taskId: string, due: string | null): Promise<Undoable> {
  const user = await requireUser();
  const d = due && /^\d{4}-\d{2}-\d{2}$/.test(due) ? due : null;
  db.prepare(`UPDATE tasks SET due_at = ? WHERE id = ? AND user_id = ?`).run(d, taskId, user.id);
  refresh();
  return { message: d ? `Due ${d}` : "Date cleared" };
}

export async function addTask(_prev: FormState, f: FormData): Promise<FormState> {
  const user = await requireUser();
  const title = str(f, "title");
  if (!title) return { error: "What needs doing?" };
  const due = /^\d{4}-\d{2}-\d{2}$/.test(str(f, "due_at")) ? str(f, "due_at") : null;
  db.prepare(`INSERT INTO tasks (id, user_id, opportunity_id, title, due_at) VALUES (?, ?, ?, ?, ?)`).run(
    id("tsk"), user.id, str(f, "opportunity_id") || null, title, due,
  );
  refresh();
  return { ok: true };
}

export async function deleteTask(taskId: string): Promise<Undoable> {
  const user = await requireUser();
  db.prepare(`UPDATE tasks SET deleted_at = ? WHERE id = ? AND user_id = ?`).run(nowIso(), taskId, user.id);
  refresh();
  return { message: "Task deleted", undo: { op: "restore", table: "tasks", id: taskId } };
}

/**
 * Quick add (C): one line with a natural date ("Rhodes essay due Nov 20") becomes a task;
 * a pasted link becomes an Interested opportunity.
 */
export async function quickAdd(text: string): Promise<Undoable> {
  const user = await requireUser();
  const t = text.trim().slice(0, 300);
  if (!t) return { error: "Type a task or paste a link" };
  const url = t.match(/https?:\/\/\S+/)?.[0];
  if (url) {
    let host = "";
    try { host = new URL(url).hostname.replace(/^(www|jobs|careers|boards|apply)\./, ""); } catch { return { error: "That link doesn't look right" }; }
    const rest = t.replace(url, "").trim();
    const org = rest || host.split(".")[0].replace(/^\w/, (c) => c.toUpperCase());
    const opp = createOpportunity(user.id, { org: org.slice(0, 80), stage: "interested", url, manual: true });
    refresh();
    return { message: `Added ${opp.org} to Interested`, id: opp.id, undo: { op: "restore", table: "opportunities", id: opp.id } };
  }
  const parsed = chrono.parse(t, new Date(), { forwardDate: true })[0];
  const due = parsed ? parsed.start.date().toISOString().slice(0, 10) : null;
  const title = (parsed ? t.replace(parsed.text, "").replace(/\b(due|by|on)\s*$/i, "") : t).replace(/\s{2,}/g, " ").trim() || t;
  // Link to a tracked opportunity when the text names one.
  const opps = db.prepare(`SELECT id, org FROM opportunities WHERE user_id = ? AND deleted_at IS NULL AND archived = 0`).all(user.id) as { id: string; org: string }[];
  const lower = title.toLowerCase();
  const opp = opps.find((o) => o.org.length >= 3 && lower.includes(o.org.toLowerCase()));
  const tid = id("tsk");
  db.prepare(`INSERT INTO tasks (id, user_id, opportunity_id, title, due_at) VALUES (?, ?, ?, ?, ?)`).run(tid, user.id, opp?.id ?? null, title.slice(0, 200), due);
  refresh();
  // To "hide" it on undo we soft-delete; restore() of a deleted row is the inverse of create here.
  return { message: due ? `Added “${title}” · due ${due}` : `Added “${title}”`, undo: { op: "restore", table: "tasks", id: `-${tid}` } };
}

// ───────── follow-ups ─────────

export async function setFollowUp(threadId: string, state: "dismissed" | "snoozed", days = 3): Promise<Undoable> {
  const user = await requireUser();
  const prev = (db.prepare(`SELECT state, until FROM followup_state WHERE user_id = ? AND thread_id = ?`).get(user.id, threadId) as { state: string; until: string | null } | undefined) ?? null;
  const until = state === "snoozed" ? new Date(Date.now() + days * 86400_000).toISOString() : null;
  db.prepare(
    `INSERT INTO followup_state (user_id, thread_id, state, until) VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id, thread_id) DO UPDATE SET state = excluded.state, until = excluded.until`,
  ).run(user.id, threadId, state, until);
  refresh();
  return {
    message: state === "snoozed" ? `Snoozed ${days} days. It comes back sooner if they reply.` : "Follow-up done",
    undo: { op: "followup", threadId, prev },
  };
}

// ───────── review queue ─────────

type ReviewUndo = Extract<UndoOp, { op: "review" }>;

function reviewSnapshot(userId: string, msgId: string): { msg: Message; undo: ReviewUndo } | null {
  const msg = db.prepare(`SELECT * FROM messages WHERE id = ? AND user_id = ?`).get(msgId, userId) as Message | undefined;
  if (!msg) return null;
  return {
    msg,
    undo: { op: "review", msgId, prevStatus: msg.status, prevOpp: msg.opportunity_id, snoozed_until: msg.snoozed_until, opp: null, createdOpp: null, at: nowIso() },
  };
}

function suggestionFor(userId: string, msg: Message): { oppId: string | null; org: string | null; role: string | null; type: string } {
  const c = msg.classification ? JSON.parse(msg.classification) : {};
  return { oppId: msg.opportunity_id, org: c.org ?? null, role: c.role ?? null, type: c.type ?? "job" };
}

function acceptOne(userId: string, msgId: string): ReviewUndo | null {
  const snap = reviewSnapshot(userId, msgId);
  if (!snap) return null;
  const s = suggestionFor(userId, snap.msg);
  let oppId = s.oppId && snapOpp(userId, s.oppId) ? s.oppId : null;
  if (oppId) snap.undo.opp = snapOpp(userId, oppId);
  else if (s.org) {
    const opp = createOpportunity(userId, { org: s.org, role: s.role, type: TYPES.includes(s.type) ? s.type : "job", stage: "applied" });
    oppId = opp.id;
    snap.undo.createdOpp = opp.id;
  } else return null;
  assignMessage(userId, msgId, oppId);
  return snap.undo;
}

/** E: accept what Pursuit suggested (attach to the matched opportunity, or track it as new). */
export async function reviewAccept(msgId: string): Promise<Undoable> {
  const user = await requireUser();
  const u = acceptOne(user.id, msgId);
  refresh();
  if (!u) return { error: "No suggestion for this one. Use 1 to track it or 3 to attach it." };
  const opp = db.prepare(`SELECT org, stage FROM opportunities WHERE id = ?`).get(u.createdOpp ?? u.opp?.id) as { org: string; stage: string } | undefined;
  return { message: opp ? `${opp.org} · ${STAGE_NAME[opp.stage] ?? opp.stage}` : "Accepted", undo: u };
}

/** Batch: accept every routine confirmation ("application received") at once. */
export async function reviewAcceptRoutine(): Promise<Undoable> {
  const user = await requireUser();
  const rows = db.prepare(`SELECT id, classification FROM messages WHERE user_id = ? AND status = 'review'`).all(user.id) as { id: string; classification: string | null }[];
  const items: ReviewUndo[] = [];
  db.transaction(() => {
    for (const r of rows) {
      const c = r.classification ? JSON.parse(r.classification) : null;
      if (c?.kind !== "received" || !c.org) continue;
      const u = acceptOne(user.id, r.id);
      if (u) items.push(u);
    }
  })();
  refresh();
  if (!items.length) return { message: "No routine confirmations to accept" };
  return { message: `Accepted ${items.length} confirmation${items.length === 1 ? "" : "s"}`, undo: { op: "reviewBatch", items } };
}

export async function reviewAssign(msgId: string, oppId: string): Promise<Undoable> {
  const user = await requireUser();
  const snap = reviewSnapshot(user.id, msgId);
  if (!snap) return { error: "Not found" };
  snap.undo.opp = snapOpp(user.id, oppId);
  if (!snap.undo.opp) return { error: "Not found" };
  assignMessage(user.id, msgId, oppId);
  refresh();
  return { message: "Attached", undo: snap.undo };
}

export async function reviewCreate(msgId: string, org: string, role: string | null, type: string): Promise<Undoable> {
  const user = await requireUser();
  if (!org.trim()) return { error: "Add the organisation name." };
  const snap = reviewSnapshot(user.id, msgId);
  if (!snap) return { error: "Not found" };
  const opp = createOpportunity(user.id, { org: org.trim().slice(0, 80), role: role?.trim() || null, type: TYPES.includes(type) ? type : "job", stage: "applied" });
  snap.undo.createdOpp = opp.id;
  db.prepare(`UPDATE opportunities SET confirmed = 1 WHERE id = ?`).run(opp.id);
  assignMessage(user.id, msgId, opp.id);
  refresh();
  return { message: `Tracking ${opp.org}`, undo: snap.undo };
}

/** 2: not an application. Offers a narrow rule (this sender only), defaulting to "just this once". */
export async function reviewIgnore(msgId: string): Promise<Undoable> {
  const user = await requireUser();
  const snap = reviewSnapshot(user.id, msgId);
  if (!snap) return { error: "Not found" };
  db.prepare(`UPDATE messages SET status = 'ignored' WHERE id = ? AND user_id = ?`).run(msgId, user.id);
  refresh();
  const sender = snap.msg.from_addr;
  const already = db.prepare(`SELECT 1 FROM user_rules WHERE user_id = ? AND kind = 'ignore_sender' AND match = ?`).get(user.id, sender);
  return {
    message: "Marked as not an application",
    undo: snap.undo,
    prompt: already ? undefined : { kind: "ignore_sender", match: sender, label: `Ignore future emails from ${sender}?` },
  };
}

/** H: snooze a review item for 3 days. */
export async function reviewSnooze(msgId: string, days = 3): Promise<Undoable> {
  const user = await requireUser();
  const snap = reviewSnapshot(user.id, msgId);
  if (!snap) return { error: "Not found" };
  db.prepare(`UPDATE messages SET snoozed_until = ? WHERE id = ? AND user_id = ?`).run(new Date(Date.now() + days * 86400_000).toISOString(), msgId, user.id);
  refresh();
  return { message: `Snoozed for ${days} days`, undo: snap.undo };
}

export async function reprocessAll() {
  const user = await requireUser();
  const ids = db.prepare(`SELECT id FROM messages WHERE user_id = ? AND status IN ('review','new')`).all(user.id) as { id: string }[];
  for (const m of ids) await processMessage(user.id, m.id);
  refresh();
}

function undoReview(userId: string, u: ReviewUndo) {
  db.prepare(`DELETE FROM events WHERE message_id = ? AND user_id = ?`).run(u.msgId, userId);
  db.prepare(`DELETE FROM tasks WHERE message_id = ? AND user_id = ? AND created_at >= ?`).run(u.msgId, userId, u.at);
  const oppId = u.opp?.id ?? u.createdOpp;
  if (oppId) db.prepare(`UPDATE tasks SET done = 0, done_at = NULL WHERE opportunity_id = ? AND user_id = ? AND done_at >= ?`).run(oppId, userId, u.at);
  if (u.opp) restoreOpp(userId, u.opp);
  db.prepare(`UPDATE messages SET status = ?, opportunity_id = ?, snoozed_until = ? WHERE id = ? AND user_id = ?`).run(u.prevStatus, u.prevOpp, u.snoozed_until, u.msgId, userId);
  if (u.createdOpp) db.prepare(`DELETE FROM opportunities WHERE id = ? AND user_id = ?`).run(u.createdOpp, userId);
}

// ───────── rules ─────────

export async function addRule(rule: RulePrompt): Promise<Undoable> {
  const user = await requireUser();
  const match = rule.match.trim().toLowerCase().slice(0, 200);
  if (!match) return { error: "Nothing to match" };
  const rid = id("rul");
  db.prepare(`INSERT INTO user_rules (id, user_id, kind, match, value) VALUES (?, ?, ?, ?, ?)`).run(
    rid, user.id, rule.kind, match, rule.kind === "org_alias" ? rule.value.slice(0, 80) : null,
  );
  refresh();
  return { message: rule.kind === "org_alias" ? "Rule saved" : `Pursuit will skip ${match} from now on`, undo: { op: "rule", id: rid } };
}

export async function addIgnoreRule(_prev: FormState, f: FormData): Promise<FormState> {
  const user = await requireUser();
  const raw = str(f, "match", 200).toLowerCase().replace(/^@/, "");
  if (!raw) return { error: "Enter an email address or a domain." };
  const kind = raw.includes("@") ? "ignore_sender" : "ignore_domain";
  if (kind === "ignore_domain" && !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(raw)) return { error: "That doesn't look like a domain." };
  db.prepare(`INSERT INTO user_rules (id, user_id, kind, match) VALUES (?, ?, ?, ?)`).run(id("rul"), user.id, kind, kind === "ignore_sender" ? addressOf(raw) : raw);
  refresh();
  return { ok: true };
}

export async function deleteRule(ruleId: string) {
  const user = await requireUser();
  db.prepare(`DELETE FROM user_rules WHERE id = ? AND user_id = ?`).run(ruleId, user.id);
  refresh();
}

// ───────── undo ─────────

export async function undo(u: UndoOp): Promise<Undoable> {
  const user = await requireUser();
  const uid = user.id;
  db.transaction(() => {
    switch (u.op) {
      case "opp":
        u.snap.forEach((s) => restoreOpp(uid, s));
        break;
      case "restore":
        if (u.id.startsWith("-")) db.prepare(`DELETE FROM ${u.table} WHERE id = ? AND user_id = ?`).run(u.id.slice(1), uid);
        else db.prepare(`UPDATE ${u.table} SET deleted_at = NULL WHERE id = ? AND user_id = ?`).run(u.id, uid);
        break;
      case "task":
        db.prepare(`UPDATE tasks SET done = ?, done_at = ?, snoozed_until = ? WHERE id = ? AND user_id = ?`).run(u.done, u.done_at, u.snoozed_until, u.id, uid);
        break;
      case "followup":
        if (u.prev) db.prepare(`UPDATE followup_state SET state = ?, until = ? WHERE user_id = ? AND thread_id = ?`).run(u.prev.state, u.prev.until, uid, u.threadId);
        else db.prepare(`DELETE FROM followup_state WHERE user_id = ? AND thread_id = ?`).run(uid, u.threadId);
        break;
      case "review":
        undoReview(uid, u);
        break;
      case "reviewBatch":
        [...u.items].reverse().forEach((i) => undoReview(uid, i));
        break;
      case "ask":
        db.prepare(`UPDATE asks SET status = ?, submitted_at = ? WHERE id = ? AND user_id = ?`).run(u.status, u.submitted_at, u.id, uid);
        break;
      case "rule":
        db.prepare(`DELETE FROM user_rules WHERE id = ? AND user_id = ?`).run(u.id, uid);
        break;
    }
  })();
  refresh();
  return { message: "Undone" };
}

// ───────── people & asks ─────────

export async function savePerson(_prev: FormState, f: FormData): Promise<FormState> {
  const user = await requireUser();
  const name = str(f, "name", 80);
  if (!name) return { error: "Add a name." };
  const email = str(f, "email", 120).toLowerCase() || null;
  const pid = str(f, "id");
  if (pid) {
    db.prepare(`UPDATE people SET name = ?, email = ?, relation = ? WHERE id = ? AND user_id = ?`).run(name, email, str(f, "relation", 60) || null, pid, user.id);
  } else {
    db.prepare(`INSERT INTO people (id, user_id, name, email, relation) VALUES (?, ?, ?, ?, ?)`).run(id("per"), user.id, name, email, str(f, "relation", 60) || null);
  }
  refresh();
  return { ok: true };
}

export async function saveAsk(_prev: FormState, f: FormData): Promise<FormState> {
  const user = await requireUser();
  const personId = str(f, "person_id");
  if (!personId) return { error: "Choose a person." };
  const kind = ["recommendation", "review", "referral", "other"].includes(str(f, "kind")) ? str(f, "kind") : "recommendation";
  const status = ["to_ask", "asked", "agreed", "submitted", "declined"].includes(str(f, "status")) ? str(f, "status") : "asked";
  const due = /^\d{4}-\d{2}-\d{2}$/.test(str(f, "due_at")) ? str(f, "due_at") : null;
  const askId = str(f, "id");
  if (askId) {
    db.prepare(
      `UPDATE asks SET person_id = ?, opportunity_id = ?, kind = ?, status = ?, due_at = ?, notes = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ? AND user_id = ?`,
    ).run(personId, str(f, "opportunity_id") || null, kind, status, due, str(f, "notes", 500) || null, askId, user.id);
  } else {
    db.prepare(`INSERT INTO asks (id, user_id, person_id, opportunity_id, kind, status, due_at, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
      id("ask"), user.id, personId, str(f, "opportunity_id") || null, kind, status, due, str(f, "notes", 500) || null,
    );
  }
  refresh();
  return { ok: true };
}

export async function setAskStatus(askId: string, status: string): Promise<Undoable> {
  const user = await requireUser();
  if (!["to_ask", "asked", "agreed", "submitted", "declined"].includes(status)) return { error: "Unknown status" };
  const prev = db.prepare(`SELECT status, submitted_at FROM asks WHERE id = ? AND user_id = ?`).get(askId, user.id) as { status: string; submitted_at: string | null } | undefined;
  if (!prev) return { error: "Not found" };
  db.prepare(
    `UPDATE asks SET status = ?, submitted_at = CASE WHEN ? = 'submitted' THEN IFNULL(submitted_at, ?) ELSE submitted_at END,
       updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ? AND user_id = ?`,
  ).run(status, status, nowIso(), askId, user.id);
  refresh();
  const word: Record<string, string> = { to_ask: "to ask", asked: "requested", agreed: "accepted", submitted: "submitted", declined: "declined" };
  return { message: `Marked ${word[status]}`, undo: { op: "ask", id: askId, ...prev } };
}

export async function deletePerson(personId: string): Promise<Undoable> {
  const user = await requireUser();
  db.prepare(`UPDATE people SET deleted_at = ? WHERE id = ? AND user_id = ?`).run(nowIso(), personId, user.id);
  refresh();
  return { message: "Person removed", undo: { op: "restore", table: "people", id: personId } };
}

// ───────── answers ─────────

export async function saveSnippet(_prev: FormState, f: FormData): Promise<FormState> {
  const user = await requireUser();
  const title = str(f, "title", 120);
  const body = str(f, "body", 10000);
  if (!title || !body) return { error: "Add a title and the text." };
  const tags = str(f, "tags", 200).split(",").map((t) => t.trim().toLowerCase()).filter(Boolean).join(",");
  const sid = str(f, "id");
  if (sid) {
    db.prepare(`UPDATE snippets SET title = ?, body = ?, tags = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ? AND user_id = ?`).run(title, body, tags, sid, user.id);
  } else {
    db.prepare(`INSERT INTO snippets (id, user_id, title, body, tags) VALUES (?, ?, ?, ?, ?)`).run(id("snp"), user.id, title, body, tags);
  }
  refresh();
  return { ok: true };
}

export async function recordSnippetUse(sid: string) {
  const user = await requireUser();
  db.prepare(`UPDATE snippets SET uses = uses + 1 WHERE id = ? AND user_id = ?`).run(sid, user.id);
}

export async function deleteSnippet(sid: string): Promise<Undoable> {
  const user = await requireUser();
  db.prepare(`UPDATE snippets SET deleted_at = ? WHERE id = ? AND user_id = ?`).run(nowIso(), sid, user.id);
  refresh();
  return { message: "Answer deleted", undo: { op: "restore", table: "snippets", id: sid } };
}

// ───────── settings ─────────

export async function updateSettings(_prev: FormState, f: FormData): Promise<FormState> {
  const user = await requireUser();
  const tz = str(f, "timezone");
  if (!isValidTimeZone(tz)) return { error: "That timezone isn't recognised." };
  const followup = Math.min(Math.max(Number(f.get("followup_days")) || 7, 2), 60);
  const stale = Math.min(Math.max(Number(f.get("stale_days")) || 21, 7), 120);
  db.prepare(`UPDATE users SET name = ?, timezone = ?, followup_days = ?, stale_days = ? WHERE id = ?`).run(
    str(f, "name", 60) || user.name, tz, followup, stale, user.id,
  );
  refresh();
  return { ok: true };
}

export async function updateNotifications(_prev: FormState, f: FormData): Promise<FormState> {
  const user = await requireUser();
  const cadence = ["daily", "weekdays", "weekly"].includes(str(f, "digest_cadence")) ? str(f, "digest_cadence") : "daily";
  const hour = Math.min(Math.max(Math.round(Number(f.get("digest_hour"))), 0), 23);
  db.prepare(`UPDATE users SET brief_enabled = ?, digest_cadence = ?, digest_hour = ?, realtime_enabled = ? WHERE id = ?`).run(
    f.get("brief_enabled") === "on" ? 1 : 0, cadence, Number.isFinite(hour) ? hour : 7, f.get("realtime_enabled") === "on" ? 1 : 0, user.id,
  );
  refresh();
  return { ok: true };
}

/** Pause every notification for a week (or resume). Temporary on purpose: fully off raises anxiety. */
export async function pauseNotifications(days: number | null = 7): Promise<Undoable> {
  const user = await requireUser();
  const until = days ? new Date(Date.now() + days * 86400_000).toISOString() : null;
  db.prepare(`UPDATE users SET paused_until = ? WHERE id = ?`).run(until, user.id);
  refresh();
  return { message: until ? `Notifications paused until ${until.slice(0, 10)}` : "Notifications resumed" };
}

export async function finishOnboarding() {
  const user = await requireUser();
  db.prepare(`UPDATE users SET onboarded = 1 WHERE id = ?`).run(user.id);
  refresh();
}

/** Sandbox: load the fictional demo inbox so someone can try Pursuit before connecting anything. */
export async function loadSampleData(): Promise<Undoable> {
  const user = await requireUser();
  const emails: RawEmail[] = demoMessages().map((m) => ({
    source: "import",
    extId: m.id,
    threadId: m.threadId,
    direction: m.direction,
    from: addressOf(m.from),
    fromName: m.from.match(/^\s*"?([^"<]*?)"?\s*</)?.[1]?.trim() ?? null,
    to: m.to ?? "",
    subject: m.subject,
    snippet: null,
    body: m.body,
    date: new Date(m.date),
  }));
  const { added } = await ingest(user.id, emails);
  db.prepare(`UPDATE users SET onboarded = 1 WHERE id = ?`).run(user.id);
  refresh();
  return { message: `Loaded ${added} sample emails`, ok: true };
}

/** Live scan counts for onboarding. */
export async function scanCounts() {
  const user = await requireUser();
  const one = (sql: string) => (db.prepare(sql).get(user.id) as { n: number }).n;
  const week = new Date(Date.now() + 7 * 86400_000).toISOString().slice(0, 10);
  return {
    emails: one(`SELECT COUNT(*) n FROM messages WHERE user_id = ?`),
    applications: one(`SELECT COUNT(*) n FROM opportunities WHERE user_id = ? AND deleted_at IS NULL`),
    interviews: one(`SELECT COUNT(*) n FROM opportunities WHERE user_id = ? AND deleted_at IS NULL AND stage = 'interview'`),
    deadlines: (db.prepare(`SELECT COUNT(*) n FROM tasks WHERE user_id = ? AND done = 0 AND deleted_at IS NULL AND due_at IS NOT NULL AND due_at <= ?`).get(user.id, week) as { n: number }).n,
    review: one(`SELECT COUNT(*) n FROM messages WHERE user_id = ? AND status = 'review'`),
  };
}

export async function disconnectGmail() {
  const user = await requireUser();
  disconnectAndDelete(user.id);
  refresh();
}

export async function rotateInbound() {
  const user = await requireUser();
  db.prepare(`UPDATE users SET inbound_code = ? WHERE id = ?`).run(token(10), user.id);
  refresh();
}

export async function deleteAccount(confirmation: string) {
  const user = await requireUser();
  if (confirmation.trim().toLowerCase() !== "delete my account") return;
  disconnect(user.id);
  await destroySession();
  db.prepare(`DELETE FROM users WHERE id = ?`).run(user.id);
  redirect("/");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}
