"use client";
import { useRouter } from "next/navigation";
import { useActionState, useRef, useState } from "react";
import { addIgnoreRule, updateNotifications, updateSettings } from "../actions";
import { CopyIcon } from "@/components/icons";
import { FormError, SubmitButton } from "@/components/submit";

export function CopyField({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <input readOnly value={value} className="field h-9 min-w-0 flex-1 font-mono text-[12px]" onFocus={(e) => e.target.select()} aria-label="Value to copy" />
      <button type="button" className="btn btn-secondary btn-sm h-9" onClick={() => { void navigator.clipboard?.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
        <CopyIcon size={15} /> {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

export function PrefsForm(p: { name: string; timezone: string; followup: number; stale: number }) {
  const [state, action] = useActionState(updateSettings, undefined);
  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div><label className="label" htmlFor="s-name">Your name (signs follow-up drafts)</label><input id="s-name" className="field" name="name" defaultValue={p.name} /></div>
        <div><label className="label" htmlFor="s-tz">Timezone</label><input id="s-tz" className="field" name="timezone" defaultValue={p.timezone} /></div>
        <div><label className="label" htmlFor="s-fu">Suggest a follow-up after (days)</label><input id="s-fu" className="field" type="number" min={2} max={60} name="followup_days" defaultValue={p.followup} /></div>
        <div><label className="label" htmlFor="s-st">Flag as &ldquo;gone quiet&rdquo; after (days)</label><input id="s-st" className="field" type="number" min={7} max={120} name="stale_days" defaultValue={p.stale} /></div>
      </div>
      <FormError error={state?.error} />
      {state?.ok && <p className="text-[13px] font-medium text-sage" role="status">Saved.</p>}
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

const HOURS = Array.from({ length: 24 }, (_, h) => h);
const hourLabel = (h: number) => `${((h + 11) % 12) + 1}:00 ${h < 12 ? "am" : "pm"}`;

export function NotificationsForm(p: { brief: boolean; cadence: string; hour: number; realtime: boolean; mail: boolean }) {
  const [state, action] = useActionState(updateNotifications, undefined);
  return (
    <form action={action} className="space-y-4">
      <label className="flex items-start gap-2.5 text-[14px]">
        <input type="checkbox" name="brief_enabled" defaultChecked={p.brief} className="mt-0.5 size-4 accent-[var(--accent)]" />
        <span><span className="font-medium">Digest email</span><span className="block text-[13px] text-muted">What&apos;s due, replies, interviews scheduled, follow-ups you could send, and a weekly summary of what Pursuit tracked.</span></span>
      </label>
      <div className="grid gap-4 pl-6 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="n-cadence">How often</label>
          <select id="n-cadence" name="digest_cadence" className="field" defaultValue={p.cadence}>
            <option value="daily">Every day</option>
            <option value="weekdays">Weekdays</option>
            <option value="weekly">Weekly (Mondays)</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="n-hour">At</label>
          <select id="n-hour" name="digest_hour" className="field" defaultValue={p.hour}>
            {HOURS.map((h) => <option key={h} value={h}>{hourLabel(h)}</option>)}
          </select>
        </div>
      </div>
      <label className="flex items-start gap-2.5 text-[14px]">
        <input type="checkbox" name="realtime_enabled" defaultChecked={p.realtime} className="mt-0.5 size-4 accent-[var(--accent)]" />
        <span><span className="font-medium">Right away for time-critical things</span><span className="block text-[13px] text-muted">An interview invitation, or a deadline less than 48 hours away. Each one alerts once.</span></span>
      </label>
      {!p.mail && <p className="text-[12px] text-muted">Email delivery isn&apos;t configured on this server yet (SMTP_URL), so these settings take effect once it is.</p>}
      <FormError error={state?.error} />
      {state?.ok && <p className="text-[13px] font-medium text-sage" role="status">Saved.</p>}
      <SubmitButton className="btn btn-primary" pendingText="Saving…">Save</SubmitButton>
    </form>
  );
}

export function RuleForm() {
  const [state, action] = useActionState(addIgnoreRule, undefined);
  const ref = useRef<HTMLFormElement>(null);
  return (
    <form ref={ref} action={async (f) => { await action(f); ref.current?.reset(); }} className="flex flex-wrap items-start gap-2">
      <div className="min-w-0 flex-1">
        <label className="sr-only" htmlFor="r-match">Email address or domain to ignore</label>
        <input id="r-match" name="match" className="field h-9" placeholder="hr@employer.com or employer.com" />
      </div>
      <SubmitButton className="btn btn-secondary btn-sm h-9" pendingText="Adding…">Ignore</SubmitButton>
      <div className="basis-full"><FormError error={state?.error} /></div>
    </form>
  );
}
