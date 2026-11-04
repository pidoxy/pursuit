"use client";
import { useTransition } from "react";
import { setStage } from "@/app/app/actions";
import { STAGE_STYLE } from "./badges";

export function StageSelect({ oppId, stage, outcome, compact = false }: { oppId: string; stage: string; outcome?: string | null; compact?: boolean }) {
  const [pending, start] = useTransition();
  const value = stage === "closed" ? `closed:${outcome ?? "withdrawn"}` : stage;
  return (
    <select
      aria-label="Stage"
      disabled={pending}
      value={value}
      onChange={(e) => {
        const [s, o] = e.target.value.split(":");
        start(() => setStage(oppId, s, o ?? null));
      }}
      onClick={(e) => e.stopPropagation()}
      className={`${compact ? "h-7 text-xs" : "h-9 text-sm"} rounded-lg border border-line bg-surface px-2 font-semibold text-ink-2 ${pending ? "opacity-50" : ""}`}
    >
      {Object.entries(STAGE_STYLE).filter(([k]) => k !== "closed").map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
      <option value="closed:rejected">Closed · Rejected</option>
      <option value="closed:withdrawn">Closed · Withdrawn</option>
      <option value="closed:declined">Closed · Declined offer</option>
      <option value="closed:accepted">Closed · Accepted 🎉</option>
    </select>
  );
}
