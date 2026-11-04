"use client";
import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import { saveOpportunity } from "@/app/app/actions";
import type { Opportunity } from "@/lib/types";
import { STAGE_STYLE, TYPE_LABEL } from "./badges";
import { FormError, SubmitButton } from "./submit";

export function OppForm({ opp, onDone }: { opp?: Opportunity; onDone: () => void }) {
  const [state, action] = useActionState(saveOpportunity, undefined);
  const router = useRouter();
  useEffect(() => {
    if (state?.ok) {
      onDone();
      if (!opp && state.id) router.push(`/app/o/${state.id}`);
    }
  }, [state, onDone, opp, router]);
  return (
    <form action={action} className="space-y-4">
      {opp && <input type="hidden" name="id" value={opp.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="f-org">Organisation</label>
          <input id="f-org" className="field" name="org" defaultValue={opp?.org} required placeholder="e.g. Anthropic" />
        </div>
        <div>
          <label className="label" htmlFor="f-role">Role / programme</label>
          <input id="f-role" className="field" name="role" defaultValue={opp?.role ?? ""} placeholder="e.g. Research Resident" />
        </div>
        <div>
          <label className="label" htmlFor="f-type">Type</label>
          <select id="f-type" className="field" name="type" defaultValue={opp?.type ?? "job"}>
            {Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="f-stage">Stage</label>
          <select id="f-stage" className="field" name="stage" defaultValue={opp?.stage ?? "applied"}>
            {Object.entries(STAGE_STYLE).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="f-applied">Applied on</label>
          <input id="f-applied" className="field" type="date" name="applied_at" defaultValue={opp?.applied_at?.slice(0, 10) ?? ""} />
        </div>
        <div>
          <label className="label" htmlFor="f-loc">Location</label>
          <input id="f-loc" className="field" name="location" defaultValue={opp?.location ?? ""} placeholder="Remote, London…" />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="f-url">Link (posting or portal)</label>
        <input id="f-url" className="field" name="url" type="url" defaultValue={opp?.url ?? ""} placeholder="https://" />
      </div>
      <div>
        <label className="label" htmlFor="f-notes">Notes</label>
        <textarea id="f-notes" className="field" name="notes" rows={3} defaultValue={opp?.notes ?? ""} />
      </div>
      <FormError error={state?.error} />
      <div className="flex justify-end gap-2">
        <button type="button" className="btn btn-ghost" onClick={onDone}>Cancel</button>
        <SubmitButton className="btn btn-primary" pendingText="Saving…">{opp ? "Save" : "Add opportunity"}</SubmitButton>
      </div>
    </form>
  );
}
