"use client";
import { useTransition } from "react";

export function ActionButton({
  action,
  children,
  pendingText,
  className = "btn btn-secondary btn-sm",
  confirmText,
}: {
  action: () => Promise<unknown>;
  children: React.ReactNode;
  pendingText?: string;
  className?: string;
  confirmText?: string;
}) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      className={className}
      disabled={pending}
      onClick={() => {
        if (confirmText && !confirm(confirmText)) return;
        start(async () => {
          await action();
        });
      }}
    >
      {pending ? (pendingText ?? "…") : children}
    </button>
  );
}
