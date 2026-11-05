import "server-only";
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

export const DATA_DIR = path.resolve(process.env.DATA_DIR ?? "./data");
export const UPLOAD_DIR = path.join(DATA_DIR, "uploads");

const MIGRATIONS: string[] = [
  // 001 — initial schema
  `
  CREATE TABLE users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    timezone TEXT NOT NULL DEFAULT 'UTC',
    inbound_code TEXT NOT NULL UNIQUE,
    followup_days INTEGER NOT NULL DEFAULT 7,
    stale_days INTEGER NOT NULL DEFAULT 21,
    brief_enabled INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );

  CREATE TABLE sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL
  );

  CREATE TABLE google_accounts (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    access_token TEXT,
    access_expires_at INTEGER,
    history_id TEXT,
    backfill_state TEXT NOT NULL DEFAULT 'pending',
    last_sync_at TEXT,
    last_error TEXT
  );

  CREATE TABLE opportunities (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    org TEXT NOT NULL,
    org_key TEXT NOT NULL,
    role TEXT,
    type TEXT NOT NULL DEFAULT 'job',
    stage TEXT NOT NULL DEFAULT 'applied',
    outcome TEXT,
    url TEXT,
    location TEXT,
    notes TEXT,
    applied_at TEXT,
    last_activity_at TEXT,
    last_inbound_at TEXT,
    manual_stage INTEGER NOT NULL DEFAULT 0,
    archived INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );
  CREATE INDEX opp_user ON opportunities(user_id, stage);
  CREATE INDEX opp_org ON opportunities(user_id, org_key);

  CREATE TABLE messages (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    source TEXT NOT NULL,
    ext_id TEXT NOT NULL,
    thread_id TEXT,
    direction TEXT NOT NULL CHECK (direction IN ('in','out')),
    from_addr TEXT NOT NULL,
    from_name TEXT,
    to_addrs TEXT NOT NULL DEFAULT '',
    subject TEXT NOT NULL DEFAULT '',
    snippet TEXT,
    body TEXT,
    date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','matched','review','ignored','irrelevant')),
    opportunity_id TEXT REFERENCES opportunities(id) ON DELETE SET NULL,
    classification TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    UNIQUE (user_id, source, ext_id)
  );
  CREATE INDEX msg_user_status ON messages(user_id, status, date);
  CREATE INDEX msg_thread ON messages(user_id, thread_id, date);

  CREATE TABLE events (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    opportunity_id TEXT NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
    message_id TEXT REFERENCES messages(id) ON DELETE SET NULL,
    kind TEXT NOT NULL,
    at TEXT NOT NULL,
    summary TEXT NOT NULL
  );
  CREATE INDEX ev_opp ON events(opportunity_id, at);

  CREATE TABLE tasks (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    opportunity_id TEXT REFERENCES opportunities(id) ON DELETE CASCADE,
    message_id TEXT REFERENCES messages(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    due_at TEXT,
    done INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );
  CREATE INDEX task_user ON tasks(user_id, done, due_at);

  CREATE TABLE people (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT,
    relation TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );

  CREATE TABLE asks (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    person_id TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    opportunity_id TEXT REFERENCES opportunities(id) ON DELETE SET NULL,
    kind TEXT NOT NULL CHECK (kind IN ('recommendation','review','referral','other')),
    status TEXT NOT NULL DEFAULT 'asked' CHECK (status IN ('to_ask','asked','agreed','submitted','declined')),
    due_at TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );

  CREATE TABLE snippets (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    tags TEXT NOT NULL DEFAULT '',
    uses INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );

  CREATE TABLE followup_state (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    thread_id TEXT NOT NULL,
    state TEXT NOT NULL CHECK (state IN ('dismissed','snoozed')),
    until TEXT,
    PRIMARY KEY (user_id, thread_id)
  );

  CREATE TABLE briefs_sent (
    key TEXT PRIMARY KEY,
    sent_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );
  `,
  // 002 — design spec: soft delete + undo, snooze, confirmation state, rules, notification policy
  `
  ALTER TABLE opportunities ADD COLUMN deleted_at TEXT;
  ALTER TABLE opportunities ADD COLUMN confirmed INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE tasks ADD COLUMN snoozed_until TEXT;
  ALTER TABLE tasks ADD COLUMN done_at TEXT;
  ALTER TABLE tasks ADD COLUMN deleted_at TEXT;
  ALTER TABLE messages ADD COLUMN snoozed_until TEXT;
  ALTER TABLE people ADD COLUMN deleted_at TEXT;
  ALTER TABLE snippets ADD COLUMN deleted_at TEXT;
  ALTER TABLE asks ADD COLUMN submitted_at TEXT;
    ALTER TABLE events ADD COLUMN evidence TEXT;
    ALTER TABLE users ADD COLUMN last_receipt_at TEXT;
  ALTER TABLE users ADD COLUMN digest_cadence TEXT NOT NULL DEFAULT 'daily';
  ALTER TABLE users ADD COLUMN digest_hour INTEGER NOT NULL DEFAULT 7;
  ALTER TABLE users ADD COLUMN paused_until TEXT;
  ALTER TABLE users ADD COLUMN realtime_enabled INTEGER NOT NULL DEFAULT 1;
  ALTER TABLE users ADD COLUMN onboarded INTEGER NOT NULL DEFAULT 0;

  CREATE TABLE user_rules (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('ignore_sender','ignore_domain','org_alias')),
    match TEXT NOT NULL,
    value TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );
  CREATE INDEX rules_user ON user_rules(user_id, kind);
  `,
];

function migrate(db: Database.Database) {
  db.exec(`CREATE TABLE IF NOT EXISTS _migrations (version INTEGER PRIMARY KEY)`);
  const row = db.prepare(`SELECT MAX(version) AS v FROM _migrations`).get() as { v: number | null };
  const current = row.v ?? 0;
  for (let i = current; i < MIGRATIONS.length; i++) {
    db.transaction(() => {
      db.exec(MIGRATIONS[i]);
      db.prepare(`INSERT INTO _migrations (version) VALUES (?)`).run(i + 1);
    })();
  }
}

function open(): Database.Database {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const file = process.env.DATABASE_PATH ?? path.join(DATA_DIR, "pursuit.db");
  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  migrate(db);
  return db;
}

// Reuse a single connection across hot reloads in dev.
const g = globalThis as unknown as { __pursuitDb?: Database.Database };
export const db: Database.Database = g.__pursuitDb ?? (g.__pursuitDb = open());
