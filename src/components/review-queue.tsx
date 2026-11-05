"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { reviewAccept, reviewAcceptRoutine, reviewAssign, reviewCreate, reviewIgnore, reviewSnooze } from "@/app/app/actions";
import { STAGE_STYLE, TYPE_LABEL } from "./badges";
import { ExternalIcon } from "./icons";
import { isTyping, Kbd, useToast } from "./toast";

export type ReviewEntry = {
  id: string;
  subject: string;
  from_name: string | null;
  from_addr: string;
  date: string;
  body: string;
  link: string | null;
  guess: { org: string | null; role: string | null; type: string; kind: string | null; evidence?: string | null } | null;
  suggested: { id: string; org: string; role: string | null; stage: string } | null;
};

const KIND_WORDS: Record<string, string> = {
  received: "an application confirmation",
  assessment: "an assessment invitation",
  assessment_done: "an assessment receipt",
  interview: "an interview invite",
  offer: "an offer",
  info_request: "a request for information",
  update: "an application update",
};

/** Uncertainty in words, never percentages. Closings in a calm, neutral sentence. */
function sentence(e: ReviewEntry): string {
  const g = e.guess;
  const org = e.suggested?.org ?? g?.org;
  const role = e.suggested?.role ?? g?.role;
  if (g?.kind === "rejection") return `${org ?? "This organisation"} isn't moving forward${role ? ` with ${role}` : ""}. Close it?`;
  if (!org) return "Pursuit couldn't tell which organisation this is from.";
  if (g?.kind && KIND_WORDS[g.kind]) return `Pursuit isn't sure whether this is ${KIND_WORDS[g.kind]} from ${org}.`;
  return `Pursuit isn't sure this email is about an application with ${org}.`;
}

function suggestionLabel(e: ReviewEntry): string | null {
  if (e.guess?.kind === "rejection" && e.suggested) return `Close ${e.suggested.org}`;
  if (e.suggested) return `Attach to ${e.suggested.org}${e.suggested.role ? ` · ${e.suggested.role}` : ""}`;
  if (e.guess?.org) return `Track ${e.guess.org} as new`;
  return null;
}

/** Highlights the sentence that drove the guess inside the excerpt. */
function Excerpt({ body, evidence }: { body: string; evidence?: string | null }) {
  const text = body.slice(0, 1200);
  const at = evidence ? text.indexOf(evidence.slice(0, 80)) : -1;
  if (!evidence || at < 0) return <p className="whitespace-pre-line text-[15px] leading-6 text-ink-2">{text}</p>;
  const end = Math.min(text.length, at + evidence.length);
  return (
    <p className="whitespace-pre-line text-[15px] leading-6 text-ink-2">
      {text.slice(0, at)}
      <mark className="rounded-[3px] bg-accent-soft px-0.5 text-ink">{text.slice(at, end)}</mark>
      {text.slice(end)}
    </p>
  );
}

export function ReviewQueue({ items, opps }: { items: ReviewEntry[]; opps: { id: string; org: string; role: string | null }[] }) {
  const { act } = useToast();
  const [done, setDone] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<null | "new" | "attach">(null);
  const queue = useMemo(() => items.filter((i) => !done.has(i.id)), [items, done]);
  const cur = queue[0];
  const routine = queue.filter((i) => i.guess?.kind === "received" && i.guess.org).length;

  // When the server list changes (e.g. after Undo), forget local hides that came back.
  useEffect(() => {
    setDone((d) => new Set([...d].filter((id) => !items.some((i) => i.id === id) || d.has(id))));
  }, [items]);

  const verdict = (fn: () => Promise<unknown>) => {
    if (!cur) return;
    const id = cur.id;
    setMode(null);
    setDone((d) => new Set(d).add(id));
    act(fn as () => Promise<never>).then((r) => {
      if (r && "error" in r && r.error) setDone((d) => { const n = new Set(d); n.delete(id); return n; });
    });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!cur || mode || e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
      const k = e.key.toLowerCase();
      if (k === "1") { e.preventDefault(); setMode("new"); }
      else if (k === "2") { e.preventDefault(); verdict(() => reviewIgnore(cur.id)); }
      else if (k === "3") { e.preventDefault(); setMode("attach"); }
      else if (k === "h") { e.preventDefault(); verdict(() => reviewSnooze(cur.id)); }
      else if (k === "e" && suggestionLabel(cur)) { e.preventDefault(); verdict(() => reviewAccept(cur.id)); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!cur)
    return (
      <div className="card animate-fade px-6 py-14 text-center">
        <p className="h-section">All caught up.</p>
        <p className="mt-1 text-[14px] text-muted">Pursuit will flag anything it&apos;s unsure about.</p>
      </div>
    );

  const accept = suggestionLabel(cur);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[14px] text-ink-2">
          <span className="tabular font-medium text-ink">{queue.length}</span> {queue.length === 1 ? "email" : "emails"} to check
        </p>
        {routine > 1 && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => {
              setDone((d) => new Set([...d, ...queue.filter((i) => i.guess?.kind === "received" && i.guess.org).map((i) => i.id)]));
              act(() => reviewAcceptRoutine());
            }}
          >
            Accept all {routine} routine confirmations
          </button>
        )}
      </div>

      <article key={cur.id} className="card animate-rise overflow-hidden" aria-label="Email to review">
        <div className="border-b border-line bg-surface-2 px-5 py-3">
          <p className="text-[14px] font-medium text-ink">{sentence(cur)}</p>
        </div>
        <div className="space-y-3 px-5 py-4">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3">
            <h2 className="text-[16px] font-semibold leading-6">{cur.subject || "(no subject)"}</h2>
            <time className="text-[12px] text-muted">{new Date(cur.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</time>
          </div>
          <p className="text-[13px] text-muted">{cur.from_name ? `${cur.from_name} · ` : ""}{cur.from_addr}</p>
          <div className="max-h-72 overflow-y-auto rounded-md border border-line px-4 py-3">
            <Excerpt body={cur.body} evidence={cur.guess?.evidence} />
          </div>
          {cur.link && (
            <a className="inline-flex items-center gap-1 text-[12px] text-muted hover:text-accent" href={cur.link} target="_blank" rel="noreferrer">
              <ExternalIcon size={12} /> Open in Gmail
            </a>
          )}
        </div>

        {mode === "new" && <TrackForm entry={cur} onCancel={() => setMode(null)} onSubmit={(org, role, type) => verdict(() => reviewCreate(cur.id, org, role, type))} />}
        {mode === "attach" && <AttachPicker opps={opps} onCancel={() => setMode(null)} onPick={(oid) => verdict(() => reviewAssign(cur.id, oid))} />}

        <div className="flex flex-wrap gap-1.5 border-t border-line px-5 py-3">
          {accept && (
            <button type="button" className="btn btn-primary btn-sm" onClick={() => verdict(() => reviewAccept(cur.id))}>
              {accept} <span className="kbd max-sm:hidden border-white/30 bg-transparent text-current">E</span>
            </button>
          )}
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setMode("new")}>Track as new <Kbd>1</Kbd></button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => verdict(() => reviewIgnore(cur.id))}>Not an application <Kbd>2</Kbd></button>
          {opps.length > 0 && <button type="button" className="btn btn-secondary btn-sm" onClick={() => setMode("attach")}>Attach to… <Kbd>3</Kbd></button>}
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => verdict(() => reviewSnooze(cur.id))}>Snooze <Kbd>H</Kbd></button>
        </div>
      </article>
      {queue.length > 1 && <p className="text-[12px] text-muted">Next: {queue[1].subject}</p>}
    </div>
  );
}

function TrackForm({ entry, onSubmit, onCancel }: { entry: ReviewEntry; onSubmit: (org: string, role: string | null, type: string) => void; onCancel: () => void }) {
  const [org, setOrg] = useState(entry.guess?.org ?? "");
  const [role, setRole] = useState(entry.guess?.role ?? "");
  const [type, setType] = useState(entry.guess?.type ?? "job");
  return (
    <form
      className="grid gap-2 border-t border-line bg-surface-2 px-5 py-3 sm:grid-cols-[1fr_1fr_auto_auto_auto]"
      onSubmit={(e) => { e.preventDefault(); if (org.trim()) onSubmit(org, role || null, type); }}
      onKeyDown={(e) => e.key === "Escape" && onCancel()}
    >
      <input autoFocus className="field h-9" value={org} onChange={(e) => setOrg(e.target.value)} placeholder="Organisation" aria-label="Organisation" />
      <input className="field h-9" value={role} onChange={(e) => setRole(e.target.value)} placeholder="Role (optional)" aria-label="Role" />
      <select className="field h-9 w-auto" value={type} onChange={(e) => setType(e.target.value)} aria-label="Type">
        {Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>
      <button className="btn btn-primary btn-sm h-9" disabled={!org.trim()}>Track</button>
      <button type="button" className="btn btn-ghost btn-sm h-9" onClick={onCancel}>Cancel</button>
    </form>
  );
}

function AttachPicker({ opps, onPick, onCancel }: { opps: { id: string; org: string; role: string | null }[]; onPick: (id: string) => void; onCancel: () => void }) {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (s ? opps.filter((o) => `${o.org} ${o.role ?? ""}`.toLowerCase().includes(s)) : opps).slice(0, 8);
  }, [q, opps]);
  return (
    <div className="border-t border-line bg-surface-2 px-5 py-3">
      <input
        ref={input}
        autoFocus
        className="field h-9"
        placeholder="Find an opportunity…"
        aria-label="Find an opportunity to attach to"
        value={q}
        onChange={(e) => { setQ(e.target.value); setSel(0); }}
        onKeyDown={(e) => {
          if (e.key === "Escape") onCancel();
          if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(list.length - 1, s + 1)); }
          if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
          if (e.key === "Enter" && list[sel]) { e.preventDefault(); onPick(list[sel].id); }
        }}
      />
      <ul className="mt-1.5 space-y-px" role="listbox" aria-label="Opportunities">
        {list.map((o, i) => (
          <li key={o.id} role="option" aria-selected={i === sel}>
            <button type="button" onMouseMove={() => setSel(i)} onClick={() => onPick(o.id)} className={`flex h-9 w-full items-center gap-2 rounded-md px-2 text-left text-[13px] ${i === sel ? "bg-hover" : ""}`}>
              <span className="font-medium">{o.org}</span>
              {o.role && <span className="truncate text-muted">{o.role}</span>}
            </button>
          </li>
        ))}
        {!list.length && <li className="px-2 py-2 text-[13px] text-muted">No match</li>}
      </ul>
    </div>
  );
}

export { STAGE_STYLE };
