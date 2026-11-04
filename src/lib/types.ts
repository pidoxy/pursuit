export interface User {
  id: string;
  email: string;
  name: string;
  timezone: string;
  inbound_code: string;
  followup_days: number;
  stale_days: number;
  brief_enabled: number;
}

export interface Opportunity {
  id: string;
  user_id: string;
  org: string;
  org_key: string;
  role: string | null;
  type: string;
  stage: string;
  outcome: string | null;
  url: string | null;
  location: string | null;
  notes: string | null;
  applied_at: string | null;
  last_activity_at: string | null;
  last_inbound_at: string | null;
  manual_stage: number;
  archived: number;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  user_id: string;
  source: string;
  ext_id: string;
  thread_id: string | null;
  direction: "in" | "out";
  from_addr: string;
  from_name: string | null;
  to_addrs: string;
  subject: string;
  snippet: string | null;
  body: string | null;
  date: string;
  status: "new" | "matched" | "review" | "ignored" | "irrelevant";
  opportunity_id: string | null;
  classification: string | null;
}

export interface EventRow {
  id: string;
  opportunity_id: string;
  message_id: string | null;
  kind: string;
  at: string;
  summary: string;
}

export interface Task {
  id: string;
  opportunity_id: string | null;
  message_id: string | null;
  title: string;
  due_at: string | null;
  done: number;
  created_at: string;
}

export interface Person {
  id: string;
  name: string;
  email: string | null;
  relation: string | null;
}

export interface Ask {
  id: string;
  person_id: string;
  opportunity_id: string | null;
  kind: "recommendation" | "review" | "referral" | "other";
  status: "to_ask" | "asked" | "agreed" | "submitted" | "declined";
  due_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Snippet {
  id: string;
  title: string;
  body: string;
  tags: string;
  uses: number;
  updated_at: string;
}

/** Normalised email handed to ingestion from any source. */
export interface RawEmail {
  source: "gmail" | "forward" | "import" | "manual";
  extId: string;
  threadId: string | null;
  direction: "in" | "out";
  from: string;
  fromName: string | null;
  to: string;
  subject: string;
  snippet: string | null;
  body: string;
  date: Date;
}
