"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { destroySession, requireUser } from "@/lib/auth";
import { orgKey, STAGES } from "@/lib/classify/rules";
import { db } from "@/lib/db";
import { disconnect } from "@/lib/gmail";
import { id, token } from "@/lib/ids";
import { assignMessage, createOpportunity, processMessage } from "@/lib/ingest";
import { isValidTimeZone } from "@/lib/time";

export type FormState = { error?: string; ok?: boolean; id?: string } | undefined;

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
    db.prepare(
      `UPDATE opportunities SET org = ?, org_key = ?, role = ?, type = ?, stage = ?, url = ?, location = ?, notes = ?, applied_at = ?,
         manual_stage = CASE WHEN stage != ? THEN 1 ELSE manual_stage END,
         outcome = CASE WHEN ? != 'closed' THEN NULL ELSE outcome END,
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
       WHERE id = ? AND user_id = ?`,
    ).run(fields.org, orgKey(fields.org) || fields.org.toLowerCase(), fields.role, fields.type, fields.stage, fields.url, fields.location, fields.notes, fields.applied_at, fields.stage, fields.stage, oppId, user.id);
    refresh();
    return { ok: true, id: oppId };
  }
  const opp = createOpportunity(user.id, { ...fields, manual: true });
  refresh();
  return { ok: true, id: opp.id };
}

export async function setStage(oppId: string, stage: string, outcome?: string | null) {
  const user = await requireUser();
  if (!(STAGES as readonly string[]).includes(stage)) return;
  db.prepare(
    `UPDATE opportunities SET stage = ?, outcome = ?, manual_stage = 1, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ? AND user_id = ?`,
  ).run(stage, stage === "closed" ? (outcome ?? "withdrawn") : null, oppId, user.id);
  refresh();
}

export async function archiveOpportunity(oppId: string, archived: boolean) {
  const user = await requireUser();
  db.prepare(`UPDATE opportunities SET archived = ? WHERE id = ? AND user_id = ?`).run(archived ? 1 : 0, oppId, user.id);
  refresh();
}

export async function deleteOpportunity(oppId: string) {
  const user = await requireUser();
  db.prepare(`UPDATE messages SET status = 'ignored', opportunity_id = NULL WHERE opportunity_id = ? AND user_id = ?`).run(oppId, user.id);
  db.prepare(`DELETE FROM opportunities WHERE id = ? AND user_id = ?`).run(oppId, user.id);
  refresh();
  redirect("/app/pipeline");
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

export async function toggleTask(taskId: string, done: boolean) {
  const user = await requireUser();
  db.prepare(`UPDATE tasks SET done = ? WHERE id = ? AND user_id = ?`).run(done ? 1 : 0, taskId, user.id);
  refresh();
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

export async function deleteTask(taskId: string) {
  const user = await requireUser();
  db.prepare(`DELETE FROM tasks WHERE id = ? AND user_id = ?`).run(taskId, user.id);
  refresh();
}

// ───────── follow-ups ─────────

export async function setFollowUp(threadId: string, state: "dismissed" | "snoozed", days = 3) {
  const user = await requireUser();
  const until = state === "snoozed" ? new Date(Date.now() + days * 86400_000).toISOString() : null;
  db.prepare(
    `INSERT INTO followup_state (user_id, thread_id, state, until) VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id, thread_id) DO UPDATE SET state = excluded.state, until = excluded.until`,
  ).run(user.id, threadId, state, until);
  refresh();
}

// ───────── review queue ─────────

export async function reviewAssign(msgId: string, oppId: string) {
  const user = await requireUser();
  assignMessage(user.id, msgId, oppId);
  refresh();
}

export async function reviewCreate(msgId: string, org: string, role: string | null, type: string) {
  const user = await requireUser();
  if (!org.trim()) return;
  const opp = createOpportunity(user.id, { org: org.trim().slice(0, 80), role: role?.trim() || null, type: TYPES.includes(type) ? type : "job", stage: "applied" });
  assignMessage(user.id, msgId, opp.id);
  refresh();
}

export async function reviewIgnore(msgId: string) {
  const user = await requireUser();
  db.prepare(`UPDATE messages SET status = 'ignored' WHERE id = ? AND user_id = ?`).run(msgId, user.id);
  refresh();
}

export async function reprocessAll() {
  const user = await requireUser();
  const ids = db.prepare(`SELECT id FROM messages WHERE user_id = ? AND status IN ('review','new')`).all(user.id) as { id: string }[];
  for (const m of ids) await processMessage(user.id, m.id);
  refresh();
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

export async function setAskStatus(askId: string, status: string) {
  const user = await requireUser();
  if (!["to_ask", "asked", "agreed", "submitted", "declined"].includes(status)) return;
  db.prepare(`UPDATE asks SET status = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ? AND user_id = ?`).run(status, askId, user.id);
  refresh();
}

export async function deletePerson(personId: string) {
  const user = await requireUser();
  db.prepare(`DELETE FROM people WHERE id = ? AND user_id = ?`).run(personId, user.id);
  refresh();
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

export async function deleteSnippet(sid: string) {
  const user = await requireUser();
  db.prepare(`DELETE FROM snippets WHERE id = ? AND user_id = ?`).run(sid, user.id);
  refresh();
}

// ───────── settings ─────────

export async function updateSettings(_prev: FormState, f: FormData): Promise<FormState> {
  const user = await requireUser();
  const tz = str(f, "timezone");
  if (!isValidTimeZone(tz)) return { error: "That timezone isn't recognised." };
  const followup = Math.min(Math.max(Number(f.get("followup_days")) || 7, 2), 60);
  const stale = Math.min(Math.max(Number(f.get("stale_days")) || 21, 7), 120);
  db.prepare(`UPDATE users SET name = ?, timezone = ?, followup_days = ?, stale_days = ?, brief_enabled = ? WHERE id = ?`).run(
    str(f, "name", 60) || user.name, tz, followup, stale, f.get("brief_enabled") === "on" ? 1 : 0, user.id,
  );
  refresh();
  return { ok: true };
}

export async function disconnectGmail() {
  const user = await requireUser();
  disconnect(user.id);
  refresh();
}

export async function rotateInbound() {
  const user = await requireUser();
  db.prepare(`UPDATE users SET inbound_code = ? WHERE id = ?`).run(token(10), user.id);
  refresh();
}

export async function deleteAccount() {
  const user = await requireUser();
  disconnect(user.id);
  await destroySession();
  db.prepare(`DELETE FROM users WHERE id = ?`).run(user.id);
  redirect("/");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}
