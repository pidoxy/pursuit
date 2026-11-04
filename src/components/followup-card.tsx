"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { setFollowUp } from "@/app/app/actions";
import { ClockIcon, CopyIcon, ExternalIcon, XIcon } from "./icons";

export function FollowUpCard({
  f,
  draft,
  composeUrl,
  threadUrl,
}: {
  f: { threadId: string; subject: string; to: string; toName: string | null; days: number; opportunityId: string | null; org: string | null };
  draft: { subject: string; body: string };
  composeUrl: string;
  threadUrl: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();
  return (
    <li className={`rounded-xl border border-line bg-surface p-3.5 ${pending ? "opacity-50" : ""}`}>
      <div className="flex items-start gap-3">
        <span className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg text-sm font-bold ${f.days >= 14 ? "bg-danger-soft text-danger" : "bg-honey-soft text-honey"}`}>
          {f.days}d
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{f.subject || "(no subject)"}</p>
          <p className="truncate text-sm text-muted">
            You wrote to {f.toName ?? f.to} {f.days} days ago
            {f.org && f.opportunityId ? <> · <Link className="hover:text-accent" href={`/app/o/${f.opportunityId}`}>{f.org}</Link></> : null}
          </p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <button className="btn btn-primary btn-sm" onClick={() => setOpen((o) => !o)}>{open ? "Hide draft" : "Draft follow-up"}</button>
        {threadUrl && <a className="btn btn-ghost btn-sm" href={threadUrl} target="_blank" rel="noreferrer"><ExternalIcon size={14} /> Thread</a>}
        <button className="btn btn-ghost btn-sm" onClick={() => start(() => setFollowUp(f.threadId, "snoozed", 3))}><ClockIcon size={14} /> Snooze 3d</button>
        <button className="btn btn-ghost btn-sm" aria-label="Dismiss" onClick={() => start(() => setFollowUp(f.threadId, "dismissed"))}><XIcon size={14} /> Done</button>
      </div>
      {open && (
        <div className="mt-3 rounded-lg border border-line bg-surface-2 p-3">
          <p className="text-xs font-semibold text-muted">Subject: {draft.subject}</p>
          <pre className="mt-2 whitespace-pre-wrap font-sans text-sm leading-relaxed text-ink-2">{draft.body}</pre>
          <div className="mt-3 flex gap-2">
            <a className="btn btn-primary btn-sm" href={composeUrl} target="_blank" rel="noreferrer">Open in Gmail</a>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => {
                void navigator.clipboard?.writeText(draft.body);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              <CopyIcon size={14} /> {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
