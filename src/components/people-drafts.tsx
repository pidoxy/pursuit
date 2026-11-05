"use client";
import { useState } from "react";
import { CopyIcon } from "./icons";

function composeUrl(to: string, su: string, body: string) {
  return `https://mail.google.com/mail/?${new URLSearchParams({ view: "cm", fs: "1", to, su, body })}`;
}

export function Draft({ label, to, subject, body }: { label: string; to: string | null; subject: string; body: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-1">
      <button type="button" className="text-[12px] font-medium text-accent hover:underline" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        {open ? "Hide draft" : label}
      </button>
      {open && (
        <div className="animate-rise mt-2 rounded-md border border-line bg-surface-2 p-3">
          <p className="text-[12px] font-medium text-muted">Subject: {subject}</p>
          <pre className="mt-2 whitespace-pre-wrap font-sans text-[15px] leading-6 text-ink-2">{body}</pre>
          <div className="mt-3 flex gap-2">
            {to && <a className="btn btn-primary btn-sm" href={composeUrl(to, subject, body)} target="_blank" rel="noreferrer">Open in Gmail</a>}
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => { void navigator.clipboard?.writeText(body); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
            >
              <CopyIcon size={14} /> {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const first = (n: string) => n.replace(/^(dr|prof|mr|mrs|ms)\.?\s+/i, "").split(" ")[0];
const honorific = (n: string) => (/^(dr|prof)\.?\s/i.test(n) ? n.split(" ").slice(0, 1).concat(n.split(" ").slice(-1)).join(" ") : first(n));

/** Thank-you draft offered once a recommender's letter is in. */
export function ThanksDraft({ name, email, org, sender }: { name: string; email: string | null; org: string | null; sender: string }) {
  const body = `Dear ${honorific(name)},

Thank you so much for submitting your letter${org ? ` for my ${org} application` : ""}. I really appreciate the time and care you put into it, and I'll let you know how it goes.

With gratitude,
${sender}`;
  return <Draft label="Thank-you draft" to={email} subject={`Thank you${org ? ` – ${org}` : ""}`} body={body} />;
}

/** A polite nudge, modelled on portal reminder emails: specific, short, with the due date. */
export function NudgeDraft({ name, email, org, due, sender }: { name: string; email: string | null; org: string | null; due: string | null; sender: string }) {
  const when = due ? new Date(due + "T12:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "UTC" }) : null;
  const body = `Dear ${honorific(name)},

I hope you're well. A gentle reminder about the letter of recommendation${org ? ` for ${org}` : ""}${when ? `, which is due on ${when}` : ""}. Please let me know if there's anything I can send that would make it easier, such as my CV or a summary of the programme.

Thank you again for your support.

Best regards,
${sender}`;
  return <Draft label="Nudge draft" to={email} subject={`Gentle reminder: recommendation${org ? ` for ${org}` : ""}`} body={body} />;
}
