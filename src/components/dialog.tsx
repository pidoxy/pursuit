"use client";
import { useEffect, useRef, useState } from "react";

/** Button that opens a modal; children get a `close` callback. */
export function DialogButton({
  label,
  title,
  className = "btn btn-secondary",
  children,
  autoOpen = false,
}: {
  label: React.ReactNode;
  title: string;
  className?: string;
  children: (close: () => void) => React.ReactNode;
  autoOpen?: boolean;
}) {
  const [open, setOpen] = useState(autoOpen);
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
        className="float m-auto max-h-[90dvh] w-[min(560px,calc(100vw-24px))] overflow-y-auto rounded-xl p-0 text-ink"
      >
        {open && (
          <div className="p-6">
            <h2 className="h-section mb-4">{title}</h2>
            {children(() => setOpen(false))}
          </div>
        )}
      </dialog>
    </>
  );
}
