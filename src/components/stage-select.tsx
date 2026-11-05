"use client";
import { useEffect, useRef, useState } from "react";
import { setStage } from "@/app/app/actions";
import { STAGE_STYLE, StageBadge } from "./badges";
import { useToast } from "./toast";

const OPTIONS: { stage: string; outcome?: string; label: string }[] = [
  { stage: "interested", label: "Interested" },
  { stage: "applied", label: "Applied" },
  { stage: "assessment", label: "Assessment" },
  { stage: "interview", label: "Interview" },
  { stage: "offer", label: "Offer" },
  { stage: "closed", outcome: "accepted", label: "Closed · Accepted" },
  { stage: "closed", outcome: "rejected", label: "Closed · Not moving forward" },
  { stage: "closed", outcome: "withdrawn", label: "Closed · Withdrawn" },
  { stage: "closed", outcome: "declined", label: "Closed · Declined offer" },
  { stage: "closed", outcome: "dormant", label: "Closed · Dormant" },
];

/**
 * "Move to…" menu: the keyboard and pointer alternative to dragging (WCAG 2.5.7).
 * Opens with M when its item is selected. Applies optimistically and offers Undo.
 */
export function StageMenu({
  oppId, stage, outcome, variant = "badge",
}: { oppId: string; stage: string; outcome?: string | null; variant?: "badge" | "button" }) {
  const { act } = useToast();
  const [open, setOpen] = useState(false);
  const [local, setLocal] = useState<{ stage: string; outcome: string | null }>({ stage, outcome: outcome ?? null });
  const [focus, setFocus] = useState(0);
  const wrap = useRef<HTMLDivElement>(null);
  const items = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => setLocal({ stage, outcome: outcome ?? null }), [stage, outcome]);
  useEffect(() => {
    if (!open) return;
    const cur = OPTIONS.findIndex((o) => o.stage === local.stage && (o.stage !== "closed" || o.outcome === local.outcome));
    setFocus(Math.max(0, cur));
    const onDown = (e: MouseEvent) => !wrap.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  useEffect(() => { if (open) items.current[focus]?.focus(); }, [open, focus]);

  const choose = (o: (typeof OPTIONS)[number]) => {
    setOpen(false);
    const prev = local;
    setLocal({ stage: o.stage, outcome: o.outcome ?? null });
    act(() => setStage(oppId, o.stage, o.outcome ?? null)).then((r) => r?.error && setLocal(prev));
  };

  return (
    <div ref={wrap} className="relative inline-block" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        data-key="m"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Stage: ${STAGE_STYLE[local.stage]?.label ?? local.stage}. Move to…`}
        onClick={(e) => { e.preventDefault(); setOpen((v) => !v); }}
        className={variant === "button" ? "btn btn-secondary btn-sm" : "inline-flex min-h-6 items-center rounded-[4px]"}
      >
        {variant === "button" ? <>Move to… <span className="kbd max-sm:hidden">M</span></> : <StageBadge stage={local.stage} outcome={local.outcome} />}
      </button>
      {open && (
        <div
          role="menu"
          aria-label="Move to stage"
          className="float animate-pop absolute left-0 top-full z-40 mt-1 w-56 rounded-lg p-1"
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" || e.key === "j") { e.preventDefault(); setFocus((f) => (f + 1) % OPTIONS.length); }
            if (e.key === "ArrowUp" || e.key === "k") { e.preventDefault(); setFocus((f) => (f - 1 + OPTIONS.length) % OPTIONS.length); }
            if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); setOpen(false); }
          }}
        >
          <p className="eyebrow px-2 pb-1 pt-1.5">Move to</p>
          {OPTIONS.map((o, i) => {
            const on = o.stage === local.stage && (o.stage !== "closed" || o.outcome === local.outcome);
            return (
              <button
                key={o.label}
                ref={(el) => { items.current[i] = el; }}
                role="menuitemradio"
                aria-checked={on}
                type="button"
                onClick={(e) => { e.preventDefault(); choose(o); }}
                className={`flex h-8 w-full items-center justify-between rounded-md px-2 text-left text-[13px] hover:bg-hover focus:bg-hover focus:outline-none ${on ? "font-medium text-ink" : "text-ink-2"}`}
              >
                {o.label}
                {on && <span aria-hidden className="text-accent">✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Back-compat name used by older pages. */
export const StageSelect = StageMenu;
