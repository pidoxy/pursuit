"use client";
import { useEffect, useRef, useState } from "react";

/** Button that opens a modal; children get a `close` callback. */
export function DialogButton({
  label,
  title,
  className = "btn btn-secondary",
  children,
}: {
  label: React.ReactNode;
  title: string;
  className?: string;
  children: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        {label}
      </button>
      <dialog
        ref={ref}
        onClose={() => setOpen(false)}
        onClick={(e) => e.target === ref.current && setOpen(false)}
        className="m-auto w-[min(560px,calc(100vw-24px))] max-h-[90dvh] overflow-y-auto rounded-2xl border border-line bg-surface p-0 text-ink shadow-lg backdrop:bg-black/40"
      >
        {open && (
          <div className="p-6">
            <h2 className="h-display mb-5 text-xl">{title}</h2>
            {children(() => setOpen(false))}
          </div>
        )}
      </dialog>
    </>
  );
}
