"use client";
import { useRef, useState, useTransition } from "react";

/**
 * Explicit confirmation, reserved for irreversible actions (disconnect-and-delete, account delete).
 * Everything else uses Undo instead. Optionally requires typing a phrase.
 */
export function ConfirmAction({
  label,
  title,
  body,
  confirmLabel,
  phrase,
  action,
  className = "btn btn-secondary",
}: {
  label: string;
  title: string;
  body: React.ReactNode;
  confirmLabel: string;
  phrase?: string;
  action: (typed: string) => Promise<unknown>;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [typed, setTyped] = useState("");
  const [pending, start] = useTransition();
  const ok = !phrase || typed.trim().toLowerCase() === phrase;
  return (
    <>
      <button type="button" className={className} onClick={() => { setTyped(""); ref.current?.showModal(); }}>{label}</button>
      <dialog ref={ref} className="float m-auto w-[min(480px,calc(100vw-24px))] rounded-xl p-0 text-ink" onClick={(e) => e.target === ref.current && ref.current?.close()}>
        <form
          className="space-y-4 p-6"
          onSubmit={(e) => {
            e.preventDefault();
            if (!ok) return;
            start(async () => { await action(typed); ref.current?.close(); });
          }}
        >
          <h2 className="h-section">{title}</h2>
          <div className="space-y-2 text-[14px] text-ink-2">{body}</div>
          {phrase && (
            <div>
              <label className="label" htmlFor="confirm-phrase">Type <strong className="text-ink">{phrase}</strong> to confirm</label>
              <input id="confirm-phrase" className="field" autoComplete="off" value={typed} onChange={(e) => setTyped(e.target.value)} />
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-ghost" onClick={() => ref.current?.close()}>Cancel</button>
            <button className="btn bg-danger text-white hover:opacity-90" disabled={!ok || pending}>{pending ? "Working…" : confirmLabel}</button>
          </div>
        </form>
      </dialog>
    </>
  );
}
