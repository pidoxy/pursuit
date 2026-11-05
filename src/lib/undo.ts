/** Serializable inverse of an action. The client holds it in an undo toast and hands it back to `undo()`. */
export type OppSnapshot = {
  id: string;
  stage: string;
  outcome: string | null;
  manual_stage: number;
  archived: number;
  role: string | null;
  type: string;
  applied_at: string | null;
  last_activity_at: string | null;
  last_inbound_at: string | null;
};

export type UndoOp =
  | { op: "opp"; snap: OppSnapshot[] }
  | { op: "restore"; table: "opportunities" | "tasks" | "people" | "snippets"; id: string }
  | { op: "task"; id: string; done: number; done_at: string | null; snoozed_until: string | null }
  | { op: "followup"; threadId: string; prev: { state: string; until: string | null } | null }
  | { op: "review"; msgId: string; prevStatus: string; prevOpp: string | null; snoozed_until: string | null; opp: OppSnapshot | null; createdOpp: string | null; at: string }
  | { op: "reviewBatch"; items: Extract<UndoOp, { op: "review" }>[] }
  | { op: "ask"; id: string; status: string; submitted_at: string | null }
  | { op: "rule"; id: string };

export type Undoable = { undo?: UndoOp; message?: string; error?: string; id?: string; ok?: boolean; prompt?: RulePrompt };

/** Narrow-default rule offered after a correction ("Just this once" is the default). */
export type RulePrompt =
  | { kind: "ignore_sender"; match: string; label: string }
  | { kind: "org_alias"; match: string; value: string; label: string };
