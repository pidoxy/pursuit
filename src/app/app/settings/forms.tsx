"use client";
import { useRouter } from "next/navigation";
import { useActionState, useRef, useState } from "react";
import { updateSettings } from "../actions";
import { CopyIcon } from "@/components/icons";
import { FormError, SubmitButton } from "@/components/submit";

export function CopyField({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <input readOnly value={value} className="field h-10 min-w-0 flex-1 font-mono text-xs" onFocus={(e) => e.target.select()} aria-label="Value to copy" />
      <button type="button" className="btn btn-secondary btn-sm h-10" onClick={() => { void navigator.clipboard?.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
        <CopyIcon size={15} /> {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

export function PrefsForm(p: { name: string; timezone: string; followup: number; stale: number; brief: boolean }) {
  const [state, action] = useActionState(updateSettings, undefined);
  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div><label className="label" htmlFor="s-name">Your name (signs follow-up drafts)</label><input id="s-name" className="field" name="name" defaultValue={p.name} /></div>
        <div><label className="label" htmlFor="s-tz">Timezone</label><input id="s-tz" className="field" name="timezone" defaultValue={p.timezone} /></div>
        <div><label className="label" htmlFor="s-fu">Suggest a follow-up after (days)</label><input id="s-fu" className="field" type="number" min={2} max={60} name="followup_days" defaultValue={p.followup} /></div>
        <div><label className="label" htmlFor="s-st">Flag as &ldquo;gone quiet&rdquo; after (days)</label><input id="s-st" className="field" type="number" min={7} max={120} name="stale_days" defaultValue={p.stale} /></div>
      </div>
      <label className="flex items-center gap-2.5 text-sm font-medium">
        <input type="checkbox" name="brief_enabled" defaultChecked={p.brief} className="size-4 accent-[var(--accent)]" />
        Email me a morning brief when something needs me
      </label>
      <FormError error={state?.error} />
      {state?.ok && <p className="text-sm font-medium text-sage">Saved.</p>}
      <SubmitButton className="btn btn-primary" pendingText="Saving…">Save</SubmitButton>
    </form>
  );
}

export function ImportForm() {
  const router = useRouter();
  const ref = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <input ref={ref} type="file" accept="application/json,.json" className="text-sm" aria-label="JSON file to import" />
        <button
          className="btn btn-secondary btn-sm"
          disabled={busy}
          onClick={async () => {
            const f = ref.current?.files?.[0];
            if (!f) return setMsg("Choose a .json file first.");
            setBusy(true);
            setMsg(null);
            const res = await fetch("/api/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: await f.text() });
            const json = await res.json().catch(() => ({}));
            setBusy(false);
            setMsg(res.ok ? `Imported ${json.added} new of ${json.received} emails.` : json.error || "Import failed.");
            router.refresh();
          }}
        >
          {busy ? "Importing…" : "Import"}
        </button>
      </div>
      {msg && <p className="text-sm text-ink-2" role="status">{msg}</p>}
    </div>
  );
}
