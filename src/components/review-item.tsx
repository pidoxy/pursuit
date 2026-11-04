"use client";
import { useState, useTransition } from "react";
import { reviewAssign, reviewCreate, reviewIgnore } from "@/app/app/actions";
import { TYPE_LABEL } from "./badges";
import { ExternalIcon } from "./icons";

export function ReviewItem({
  msg,
  guess,
  opps,
  link,
}: {
  msg: { id: string; subject: string; from_name: string | null; from_addr: string; date: string; snippet: string | null; body: string | null };
  guess: { org: string | null; role: string | null; type: string; kind: string | null; confidence: number } | null;
  opps: { id: string; org: string; role: string | null }[];
  link: string | null;
}) {
  const [pending, start] = useTransition();
  const [org, setOrg] = useState(guess?.org ?? "");
  const [role, setRole] = useState(guess?.role ?? "");
  const [type, setType] = useState(guess?.type ?? "job");
  const [target, setTarget] = useState("");
  const [gone, setGone] = useState(false);
  if (gone) return null;
  const run = (fn: () => Promise<void>) => start(async () => { setGone(true); await fn(); });
  return (
    <li className={`card p-4 ${pending ? "opacity-50" : ""}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-semibold">{msg.subject || "(no subject)"}</p>
        <p className="text-xs text-muted">{new Date(msg.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</p>
      </div>
      <p className="text-sm text-muted">{msg.from_name ? `${msg.from_name} · ` : ""}{msg.from_addr}</p>
      <p className="mt-2 line-clamp-3 text-sm text-ink-2">{(msg.snippet || msg.body || "").slice(0, 400)}</p>
      {guess?.kind && <p className="mt-2 text-xs text-muted">Looks like: <strong className="text-ink-2">{guess.kind.replace("_", " ")}</strong> · {Math.round(guess.confidence * 100)}% sure</p>}
      <div className="mt-3 grid gap-2 rounded-lg bg-surface-2 p-3 sm:grid-cols-[1fr_1fr_auto_auto]">
        <input className="field h-9 text-sm" value={org} onChange={(e) => setOrg(e.target.value)} placeholder="Organisation" aria-label="Organisation" />
        <input className="field h-9 text-sm" value={role} onChange={(e) => setRole(e.target.value)} placeholder="Role (optional)" aria-label="Role" />
        <select className="field h-9 text-sm" value={type} onChange={(e) => setType(e.target.value)} aria-label="Type">
          {Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <button className="btn btn-primary btn-sm h-9" disabled={!org.trim()} onClick={() => run(() => reviewCreate(msg.id, org, role || null, type))}>Track as new</button>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {opps.length > 0 && (
          <>
            <select className="field h-8 w-auto max-w-64 text-sm" value={target} onChange={(e) => setTarget(e.target.value)} aria-label="Attach to existing">
              <option value="">Attach to existing…</option>
              {opps.map((o) => <option key={o.id} value={o.id}>{o.org}{o.role ? ` — ${o.role}` : ""}</option>)}
            </select>
            <button className="btn btn-secondary btn-sm" disabled={!target} onClick={() => run(() => reviewAssign(msg.id, target))}>Attach</button>
          </>
        )}
        <button className="btn btn-ghost btn-sm" onClick={() => run(() => reviewIgnore(msg.id))}>Not an application</button>
        {link && <a className="btn btn-ghost btn-sm" href={link} target="_blank" rel="noreferrer"><ExternalIcon size={13} /> Gmail</a>}
      </div>
    </li>
  );
}
