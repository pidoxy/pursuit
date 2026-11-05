"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { archiveOpportunity, confirmOpportunity, deleteOpportunity } from "@/app/app/actions";
import { ArchiveIcon, CheckIcon, TrashIcon } from "./icons";
import { Draft } from "./people-drafts";
import { Kbd, useToast } from "./toast";
import { usePaletteScope } from "./app-shell";
import { setStage } from "@/app/app/actions";

const STAGES: [string, string][] = [["interested", "Interested"], ["applied", "Applied"], ["assessment", "Assessment"], ["interview", "Interview"], ["offer", "Offer"]];

/** Archive / delete with Undo instead of a confirm dialog. Registers item-scoped palette commands. */
export function OppActions({ id, org, archived }: { id: string; org: string; archived: boolean }) {
  const { act } = useToast();
  const router = useRouter();
  usePaletteScope([
    ...STAGES.map(([s, label]) => ({ id: `scope-move-${s}`, title: `Move ${org} to ${label}`, group: "This opportunity", run: () => { act(() => setStage(id, s)); } })),
    { id: "scope-close", title: `Close ${org} · not moving forward`, group: "This opportunity", run: () => { act(() => setStage(id, "closed", "rejected")); } },
    { id: "scope-archive", title: archived ? `Unarchive ${org}` : `Archive ${org}`, group: "This opportunity", run: () => { act(() => archiveOpportunity(id, !archived)); } },
    { id: "scope-delete", title: `Delete ${org}`, group: "This opportunity", keys: ["⌫"], run: () => { del(); } },
  ]);
  const del = async () => {
    const r = await act(() => deleteOpportunity(id));
    if (r && !r.error) router.push("/app/pipeline");
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.metaKey || e.ctrlKey || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName)) return;
      if (e.key === "Backspace" && !document.querySelector("[data-selected=true]")) { e.preventDefault(); del(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  return (
    <div className="flex flex-wrap gap-1.5">
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => act(() => archiveOpportunity(id, !archived))}>
        <ArchiveIcon size={15} /> {archived ? "Unarchive" : "Archive"}
      </button>
      <button type="button" className="btn btn-ghost btn-sm" onClick={del}>
        <TrashIcon size={15} /> Delete <Kbd>⌫</Kbd>
      </button>
    </div>
  );
}

export function ConfirmButton({ id }: { id: string }) {
  const { act } = useToast();
  const [done, setDone] = useState(false);
  if (done) return null;
  return (
    <button type="button" className="btn btn-ghost btn-sm text-accent" onClick={() => { setDone(true); act(() => confirmOpportunity(id)); }}>
      <CheckIcon size={14} /> Looks right
    </button>
  );
}

/** At most two optional, dismissible actions after a closing. Dismissing is remembered on this device. */
export function AfterClosing({ org, role, contact, sender }: { org: string; role: string | null; contact: string | null; sender: string }) {
  const [hidden, setHidden] = useState(true);
  useEffect(() => {
    try { setHidden(localStorage.getItem("pursuit:hide-after-closing") === "1"); } catch { setHidden(false); }
  }, []);
  if (hidden) return null;
  const body = `Hello,

Thank you for considering me for ${role ? `the ${role} role` : "the role"} at ${org}. If you have a moment, I'd be grateful for any feedback on my application that could help me improve.

Best regards,
${sender}`;
  return (
    <section className="rounded-lg border border-line px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[14px] text-ink-2">If it helps, two optional next steps:</p>
        <button
          type="button"
          className="text-[12px] text-muted hover:text-ink"
          onClick={() => { setHidden(true); try { localStorage.setItem("pursuit:hide-after-closing", "1"); } catch {} }}
        >
          Don&apos;t show again
        </button>
      </div>
      <div className="mt-1 flex flex-wrap items-start gap-x-5">
        <Draft label="Draft a feedback request" to={contact} subject={`Feedback on my application – ${role ?? org}`} body={body} />
        <a className="mt-1 text-[12px] font-medium text-accent hover:underline" target="_blank" rel="noreferrer" href={`https://www.google.com/search?q=${encodeURIComponent(`${role ?? org} jobs`)}`}>
          Find similar roles
        </a>
      </div>
    </section>
  );
}
