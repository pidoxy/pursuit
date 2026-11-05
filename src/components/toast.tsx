"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState, useTransition } from "react";
import { addRule, undo as undoAction } from "@/app/app/actions";
import type { RulePrompt, Undoable, UndoOp } from "@/lib/undo";

type Toast = {
  id: number;
  message: string;
  undo?: UndoOp;
  prompt?: RulePrompt;
  tone?: "error";
};

type Ctx = {
  push: (t: Omit<Toast, "id">) => void;
  /** Run a server action that returns an Undoable, then toast its message with Undo. */
  act: (fn: () => Promise<Undoable | void>) => Promise<Undoable | void>;
  pending: boolean;
};

const ToastCtx = createContext<Ctx | null>(null);
const DURATION = 6000;
const MAX = 3;

export function useToast() {
  const c = useContext(ToastCtx);
  if (!c) throw new Error("useToast outside ToastProvider");
  return c;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [pending, start] = useTransition();
  const seq = useRef(0);

  const dismiss = useCallback((id: number) => setToasts((ts) => ts.filter((t) => t.id !== id)), []);
  const push = useCallback((t: Omit<Toast, "id">) => {
    const id = ++seq.current;
    setToasts((ts) => [...ts, { ...t, id }].slice(-MAX));
  }, []);

  const runUndo = useCallback(
    (t: Toast) => {
      if (!t.undo) return;
      const op = t.undo;
      dismiss(t.id);
      start(async () => {
        await undoAction(op);
        push({ message: "Undone" });
      });
    },
    [dismiss, push],
  );

  const act = useCallback(
    async (fn: () => Promise<Undoable | void>) => {
      let res: Undoable | void = undefined;
      try {
        res = await fn();
      } catch {
        // Optimistic UI reverts on refresh; explain why.
        push({ message: "That didn't save. Check your connection and try again.", tone: "error" });
        return { error: "failed" };
      }
      if (res?.error) push({ message: res.error, tone: "error" });
      else if (res?.message || res?.prompt) {
        if (res.message) push({ message: res.message, undo: res.undo });
        if (res.prompt) push({ message: res.prompt.label, prompt: res.prompt });
      }
      return res;
    },
    [push],
  );

  // Z undoes the most recent undoable action.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "z" && e.key !== "Z") return;
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
      const last = [...toasts].reverse().find((t) => t.undo);
      if (last) {
        e.preventDefault();
        runUndo(last);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toasts, runUndo]);

  return (
    <ToastCtx.Provider value={{ push, act, pending }}>
      {children}
      {/* Bottom-left so it never covers the focused item or the mobile tab bar's primary area. */}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed bottom-20 left-3 z-50 flex w-[min(380px,calc(100vw-24px))] flex-col gap-2 lg:bottom-4 lg:left-4"
      >
        {toasts.map((t) => (
          <ToastView key={t.id} t={t} onDone={() => dismiss(t.id)} onUndo={() => runUndo(t)} onRule={(yes) => {
            dismiss(t.id);
            if (yes && t.prompt) {
              const rule = t.prompt;
              start(async () => { await act(() => addRule(rule)); });
            }
          }} />
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

function ToastView({ t, onDone, onUndo, onRule }: { t: Toast; onDone: () => void; onUndo: () => void; onRule: (yes: boolean) => void }) {
  const [paused, setPaused] = useState(false);
  const remaining = useRef(t.prompt ? DURATION * 2 : DURATION);
  useEffect(() => {
    if (paused) return;
    const started = Date.now();
    const timer = setTimeout(onDone, remaining.current);
    return () => {
      clearTimeout(timer);
      remaining.current -= Date.now() - started;
    };
  }, [paused, onDone]);
  return (
    <div
      className={`float animate-pop pointer-events-auto flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-[13px] ${t.tone === "error" ? "text-danger" : "text-ink"}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <p className="min-w-0 flex-1 leading-snug">{t.message}</p>
      {t.undo && (
        <button type="button" onClick={onUndo} className="btn btn-ghost btn-sm shrink-0 font-semibold text-accent">
          Undo <span className="kbd max-sm:hidden">Z</span>
        </button>
      )}
      {t.prompt && (
        <div className="flex shrink-0 gap-1">
          <button type="button" className="btn btn-ghost btn-sm text-accent" onClick={() => onRule(true)}>Yes</button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => onRule(false)}>Just this once</button>
        </div>
      )}
      {!t.undo && !t.prompt && (
        <button type="button" aria-label="Dismiss" className="btn btn-ghost btn-sm shrink-0 px-1.5 text-muted" onClick={onDone}>×</button>
      )}
    </div>
  );
}

export function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable || Boolean(el.closest?.("dialog[open]"));
}

/** Keycap hint, hidden on touch-sized screens. */
export function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="kbd max-sm:hidden">{children}</kbd>;
}
