"use client";
import { useTransition } from "react";
import type { Undoable } from "@/lib/undo";
import { useToast } from "./toast";

/** Runs a server action; if it returns an Undoable, shows its toast with Undo. No confirm() dialogs. */
export function ActionButton({
  action,
  children,
  pendingText,
  className = "btn btn-secondary btn-sm",
  dataKey,
}: {
  action: () => Promise<Undoable | void>;
  children: React.ReactNode;
  pendingText?: string;
  className?: string;
  dataKey?: string;
}) {
  const { act } = useToast();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      className={className}
      disabled={pending}
      data-key={dataKey}
      onClick={() => start(async () => { await act(action); })}
    >
      {pending ? (pendingText ?? "…") : children}
    </button>
  );
}
