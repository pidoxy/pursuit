"use client";
import Link from "next/link";
import { useState } from "react";
import { setFollowUp } from "@/app/app/actions";
import { CopyIcon, ExternalIcon } from "./icons";
import { Kbd, useToast } from "./toast";

/** A follow-up you could send. Waiting is normal, so no red counts: days show in muted text. */
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
  const { act } = useToast();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;
  const run = (state: "dismissed" | "snoozed") => {
    setHidden(true);
    act(() => setFollowUp(f.threadId, state, 3)).then((r) => r?.error && setHidden(false));
  };
  return (
    <li data-nav-item="" tabIndex={-1} className="row-hover -mx-2 rounded-md px-2 py-2.5 outline-none">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid h-6 min-w-9 shrink-0 place-items-center rounded-[5px] border border-line px-1 text-[12px] font-medium tabular text-muted">{f.days}d</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-medium">{f.subject || "(no subject)"}</p>
          <p className="truncate text-[12px] text-muted">
            You wrote to {f.toName ?? f.to} {f.days} days ago
            {f.org && f.opportunityId ? <> · <Link className="hover:text-accent" href={`/app/o/${f.opportunityId}`}>{f.org}</Link></> : null}
          </p>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1 pl-12">
        <button type="button" data-key="d" className="btn btn-secondary btn-sm" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          {open ? "Hide draft" : "Draft follow-up"} <Kbd>D</Kbd>
        </button>
        <button type="button" data-key="h" className="btn btn-ghost btn-sm" onClick={() => run("snoozed")} title="Comes back in 3 days, or disappears if they reply">
          Snooze 3d <Kbd>H</Kbd>
        </button>
        <button type="button" data-key="e" className="btn btn-ghost btn-sm" onClick={() => run("dismissed")}>
          Done <Kbd>E</Kbd>
        </button>
        {threadUrl && <a className="btn btn-ghost btn-sm" href={threadUrl} target="_blank" rel="noreferrer"><ExternalIcon size={14} /> Thread</a>}
      </div>
      {open && (
        <div className="animate-rise ml-12 mt-2 rounded-md border border-line bg-surface-2 p-3">
          <p className="text-[12px] font-medium text-muted">Subject: {draft.subject}</p>
          <pre className="mt-2 whitespace-pre-wrap font-sans text-[15px] leading-6 text-ink-2">{draft.body}</pre>
          <div className="mt-3 flex gap-2">
            <a className="btn btn-primary btn-sm" href={composeUrl} target="_blank" rel="noreferrer">Open in Gmail</a>
            <button
              type="button"
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
