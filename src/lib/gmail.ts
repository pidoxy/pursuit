import "server-only";
import { classifyRules } from "./classify/rules";
import { decrypt, encrypt } from "./crypto";
import { db } from "./db";
import { appUrl } from "./urls";
import { htmlToText, ingest, stripQuoted } from "./ingest";
import type { RawEmail } from "./types";

const API = "https://gmail.googleapis.com/gmail/v1/users/me";
export const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";
const BACKFILL_DAYS = Number(process.env.BACKFILL_DAYS || 180);
const BACKFILL_MAX = Number(process.env.BACKFILL_MAX || 1500);

export const googleConfigured = () => Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
export const redirectUri = () => `${appUrl()}/api/google/callback`;

export function authUrl(state: string): string {
  const p = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: `openid email ${GMAIL_SCOPE}`,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  error?: string;
  error_description?: string;
}

async function tokenRequest(params: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      ...params,
    }),
  });
  const json = (await res.json()) as TokenResponse;
  if (!res.ok || json.error) throw new Error(`Google token error: ${json.error_description ?? json.error ?? res.status}`);
  return json;
}

export async function connectWithCode(userId: string, code: string) {
  const t = await tokenRequest({ code, grant_type: "authorization_code", redirect_uri: redirectUri() });
  if (!t.refresh_token) throw new Error("Google didn't return a refresh token. Remove Pursuit from your Google account permissions and try again.");
  if (t.scope && !t.scope.includes(GMAIL_SCOPE)) throw new Error("Gmail read access wasn't granted. Please tick the Gmail permission.");
  const profile = await fetch(`${API}/profile`, { headers: { Authorization: `Bearer ${t.access_token}` } }).then((r) => r.json());
  db.prepare(
    `INSERT INTO google_accounts (user_id, email, refresh_token, access_token, access_expires_at, history_id, backfill_state)
     VALUES (?, ?, ?, ?, ?, ?, 'pending')
     ON CONFLICT(user_id) DO UPDATE SET email = excluded.email, refresh_token = excluded.refresh_token,
       access_token = excluded.access_token, access_expires_at = excluded.access_expires_at, last_error = NULL`,
  ).run(userId, profile.emailAddress, encrypt(t.refresh_token), encrypt(t.access_token), Date.now() + t.expires_in * 1000, String(profile.historyId));
}

export function disconnect(userId: string) {
  const row = db.prepare(`SELECT refresh_token FROM google_accounts WHERE user_id = ?`).get(userId) as { refresh_token: string } | undefined;
  if (row) {
    // Best-effort revoke; tokens are deleted regardless.
    fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(decrypt(row.refresh_token))}`, { method: "POST" }).catch(() => {});
  }
  db.prepare(`DELETE FROM google_accounts WHERE user_id = ?`).run(userId);
}

interface Account {
  user_id: string;
  email: string;
  refresh_token: string;
  access_token: string | null;
  access_expires_at: number | null;
  history_id: string | null;
  backfill_state: string;
}

async function accessToken(acc: Account): Promise<string> {
  if (acc.access_token && acc.access_expires_at && acc.access_expires_at > Date.now() + 60_000) return decrypt(acc.access_token);
  const t = await tokenRequest({ refresh_token: decrypt(acc.refresh_token), grant_type: "refresh_token" });
  db.prepare(`UPDATE google_accounts SET access_token = ?, access_expires_at = ? WHERE user_id = ?`).run(
    encrypt(t.access_token),
    Date.now() + t.expires_in * 1000,
    acc.user_id,
  );
  return t.access_token;
}

async function gget<T>(token: string, path: string): Promise<T> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.status === 429 || res.status >= 500) {
      await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
      continue;
    }
    if (!res.ok) {
      const err = new Error(`Gmail ${res.status} on ${path.split("?")[0]}`) as Error & { status?: number };
      err.status = res.status;
      throw err;
    }
    return (await res.json()) as T;
  }
  throw new Error("Gmail is rate limiting; will retry next sync.");
}

// ───────── message parsing ─────────

interface Part {
  mimeType?: string;
  body?: { data?: string; size?: number };
  parts?: Part[];
  headers?: { name: string; value: string }[];
}
export interface GmailMessage {
  id: string;
  threadId: string;
  labelIds?: string[];
  snippet?: string;
  internalDate?: string;
  payload?: Part;
}

const b64 = (s: string) => Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");

function findBody(p: Part | undefined, mime: string): string | null {
  if (!p) return null;
  if (p.mimeType === mime && p.body?.data) return b64(p.body.data);
  for (const c of p.parts ?? []) {
    const r = findBody(c, mime);
    if (r) return r;
  }
  return null;
}

function parseFrom(v: string): { addr: string; name: string | null } {
  const m = v.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  if (m) return { addr: m[2].trim().toLowerCase(), name: m[1].trim() || null };
  return { addr: v.trim().toLowerCase(), name: null };
}

export function parseGmailMessage(m: GmailMessage, accountEmail: string): RawEmail {
  const h = (n: string) => m.payload?.headers?.find((x) => x.name.toLowerCase() === n.toLowerCase())?.value ?? "";
  const from = parseFrom(h("From"));
  const plain = findBody(m.payload, "text/plain");
  const html = plain ? null : findBody(m.payload, "text/html");
  const body = plain ?? (html ? htmlToText(html) : (m.snippet ?? ""));
  const outbound = (m.labelIds ?? []).includes("SENT") || from.addr === accountEmail.toLowerCase();
  return {
    source: "gmail",
    extId: m.id,
    threadId: m.threadId,
    direction: outbound ? "out" : "in",
    from: from.addr,
    fromName: from.name,
    to: h("To"),
    subject: h("Subject"),
    snippet: m.snippet ? htmlToText(m.snippet) : null,
    body: outbound ? stripQuoted(body).slice(0, 2000) : body,
    date: new Date(Number(m.internalDate) || Date.parse(h("Date")) || Date.now()),
  };
}

function knownThread(userId: string, threadId: string): boolean {
  return Boolean(db.prepare(`SELECT 1 FROM messages WHERE user_id = ? AND thread_id = ? LIMIT 1`).get(userId, threadId));
}

/** Keep only what Pursuit needs: application mail, mail in tracked threads, and your sent mail. */
export function shouldKeep(userId: string, e: RawEmail): boolean {
  if (e.direction === "out") return true;
  if (e.threadId && knownThread(userId, e.threadId)) return true;
  const c = classifyRules({ from: e.from, fromName: e.fromName, subject: e.subject, body: e.body, date: e.date, direction: "in" });
  return c.relevant || c.confidence >= 0.3;
}

const BACKFILL_QUERY = (days: number) =>
  `newer_than:${days}d -in:chats -category:promotions (from:(greenhouse-mail.io OR lever.co OR myworkday.com OR ashbyhq.com OR smartrecruiters.com OR icims.com OR hackerrank.com OR hackerrankforwork.com OR codesignal.com OR hireflix.com OR oracle.com OR taleo.net OR jobvite.com OR workable.com OR successfactors.com OR hirevue.com) OR subject:(application OR applying OR applied OR interview OR assessment OR offer OR candidacy OR fellowship OR internship OR scholarship OR admission OR admissions OR recommendation OR "next steps") OR "thank you for applying" OR "unfortunately")`;

async function listIds(token: string, q: string, max: number): Promise<{ id: string; threadId: string }[]> {
  const out: { id: string; threadId: string }[] = [];
  let pageToken = "";
  while (out.length < max) {
    const r = await gget<{ messages?: { id: string; threadId: string }[]; nextPageToken?: string }>(
      token,
      `/messages?maxResults=100&q=${encodeURIComponent(q)}${pageToken ? `&pageToken=${pageToken}` : ""}`,
    );
    out.push(...(r.messages ?? []));
    if (!r.nextPageToken) break;
    pageToken = r.nextPageToken;
  }
  return out.slice(0, max);
}

async function fetchMany(token: string, ids: string[], acc: Account): Promise<RawEmail[]> {
  const out: RawEmail[] = [];
  const CONC = 8;
  for (let i = 0; i < ids.length; i += CONC) {
    const batch = await Promise.all(
      ids.slice(i, i + CONC).map((mid) => gget<GmailMessage>(token, `/messages/${mid}?format=full`).catch(() => null)),
    );
    for (const m of batch) if (m) out.push(parseGmailMessage(m, acc.email));
  }
  return out;
}

async function backfill(acc: Account, token: string) {
  db.prepare(`UPDATE google_accounts SET backfill_state = 'running' WHERE user_id = ?`).run(acc.user_id);
  const inbound = await listIds(token, BACKFILL_QUERY(BACKFILL_DAYS), BACKFILL_MAX);
  const sent = await listIds(token, `in:sent newer_than:60d`, 300);
  const emails = (await fetchMany(token, [...new Set([...inbound, ...sent].map((m) => m.id))], acc)).filter((e) =>
    shouldKeep(acc.user_id, e),
  );
  // Replies to your sent mail (needed to know who still owes you an answer).
  const sentThreads = [...new Set(sent.map((s) => s.threadId))].slice(0, 300);
  for (const tid of sentThreads) {
    const t = await gget<{ messages?: GmailMessage[] }>(token, `/threads/${tid}?format=full`).catch(() => null);
    for (const m of t?.messages ?? []) emails.push(parseGmailMessage(m, acc.email));
  }
  await ingest(acc.user_id, emails);
  db.prepare(`UPDATE google_accounts SET backfill_state = 'done' WHERE user_id = ?`).run(acc.user_id);
}

async function incremental(acc: Account, token: string) {
  let ids: string[] = [];
  let newHistory = acc.history_id;
  try {
    let pageToken = "";
    do {
      const r = await gget<{ history?: { messagesAdded?: { message: { id: string } }[] }[]; historyId: string; nextPageToken?: string }>(
        token,
        `/history?startHistoryId=${acc.history_id}&historyTypes=messageAdded&maxResults=500${pageToken ? `&pageToken=${pageToken}` : ""}`,
      );
      for (const h of r.history ?? []) for (const a of h.messagesAdded ?? []) ids.push(a.message.id);
      newHistory = r.historyId;
      pageToken = r.nextPageToken ?? "";
    } while (pageToken && ids.length < 2000);
  } catch (err) {
    if ((err as { status?: number }).status !== 404) throw err;
    // History expired: fall back to a recent query.
    ids = (await listIds(token, `newer_than:3d -in:chats`, 500)).map((m) => m.id);
    const profile = await gget<{ historyId: string }>(token, `/profile`);
    newHistory = profile.historyId;
  }
  const emails = (await fetchMany(token, [...new Set(ids)], acc)).filter((e) => shouldKeep(acc.user_id, e));
  await ingest(acc.user_id, emails);
  db.prepare(`UPDATE google_accounts SET history_id = ? WHERE user_id = ?`).run(newHistory, acc.user_id);
}

const running = new Set<string>();

export async function syncUser(userId: string): Promise<{ ok: boolean; error?: string }> {
  if (running.has(userId)) return { ok: true };
  const acc = db.prepare(`SELECT * FROM google_accounts WHERE user_id = ?`).get(userId) as Account | undefined;
  if (!acc) return { ok: false, error: "Gmail not connected" };
  running.add(userId);
  try {
    const token = await accessToken(acc);
    if (acc.backfill_state !== "done") await backfill(acc, token);
    else await incremental(acc, token);
    db.prepare(`UPDATE google_accounts SET last_sync_at = ?, last_error = NULL WHERE user_id = ?`).run(new Date().toISOString(), userId);
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[gmail ${userId}]`, message);
    db.prepare(`UPDATE google_accounts SET last_error = ?, backfill_state = CASE WHEN backfill_state = 'running' THEN 'pending' ELSE backfill_state END WHERE user_id = ?`).run(
      message.slice(0, 300),
      userId,
    );
    return { ok: false, error: message };
  } finally {
    running.delete(userId);
  }
}

export async function syncAll() {
  const users = db.prepare(`SELECT user_id FROM google_accounts`).all() as { user_id: string }[];
  for (const u of users) await syncUser(u.user_id);
}
