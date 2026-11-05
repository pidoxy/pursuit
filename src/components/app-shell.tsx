"use client";
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { markStaleDormant, pauseNotifications, quickAdd, setStage, archiveOpportunity } from "@/app/app/actions";
import { isTyping, ToastProvider, useToast } from "./toast";
import { STAGE_STYLE } from "./badges";

export type PaletteOpp = { id: string; org: string; role: string | null; stage: string };

type Command = {
  id: string;
  title: string;
  hint?: string;
  group: string;
  keys?: string[];
  keywords?: string;
  run: () => void | Promise<void>;
  /** ⌘Enter and ⌥Enter alternatives. */
  secondary?: { title: string; run: () => void | Promise<void> };
  tertiary?: { title: string; run: () => void | Promise<void> };
};

type ShellCtx = {
  openPalette: (mode?: "commands" | "quickadd" | "search") => void;
  setScope: (cmds: Command[] | null) => void;
};
const Shell = createContext<ShellCtx | null>(null);
export const useShell = () => useContext(Shell);

/** Register item-scoped commands (e.g. "Move to Interview") while a page or item is in view. */
export function usePaletteScope(cmds: Command[] | null) {
  const s = useShell();
  const key = cmds?.map((c) => c.id).join("|") ?? "";
  const ref = useRef(cmds);
  ref.current = cmds;
  useEffect(() => {
    s?.setScope(ref.current);
    return () => s?.setScope(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}

const NAV_KEYS: Record<string, { href: string; label: string }> = {
  t: { href: "/app", label: "Today" },
  p: { href: "/app/pipeline", label: "Pipeline" },
  r: { href: "/app/review", label: "Review" },
  o: { href: "/app/people", label: "People" },
  a: { href: "/app/answers", label: "Answers" },
  i: { href: "/app/insights", label: "Insights" },
  s: { href: "/app/settings", label: "Settings" },
};

export function AppShell({ children, opps }: { children: React.ReactNode; opps: PaletteOpp[] }) {
  return (
    <ToastProvider>
      <ShellInner opps={opps}>{children}</ShellInner>
    </ToastProvider>
  );
}

function ShellInner({ children, opps }: { children: React.ReactNode; opps: PaletteOpp[] }) {
  const router = useRouter();
  const { act, push } = useToast();
  const [open, setOpen] = useState<null | "commands" | "quickadd" | "search">(null);
  const [sheet, setSheet] = useState(false);
  const [scope, setScope] = useState<Command[] | null>(null);
  const gPressed = useRef<number>(0);

  const openPalette = useCallback((mode: "commands" | "quickadd" | "search" = "commands") => setOpen(mode), []);

  // Global keys: ⌘K, G-then-X, C, /, ?, and J/K/Enter/E/H/D/M/⌫ on [data-nav-item] lists.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => (o ? null : "commands"));
        return;
      }
      if (open || sheet || e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
      const k = e.key;
      if (Date.now() - gPressed.current < 900 && NAV_KEYS[k.toLowerCase()]) {
        e.preventDefault();
        gPressed.current = 0;
        router.push(NAV_KEYS[k.toLowerCase()].href);
        return;
      }
      if (k === "g" || k === "G") { gPressed.current = Date.now(); return; }
      if (k === "c" || k === "C") { e.preventDefault(); setOpen("quickadd"); return; }
      if (k === "/") { e.preventDefault(); setOpen("search"); return; }
      if (k === "?") { e.preventDefault(); setSheet(true); return; }
      listKey(e);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, sheet, router]);

  const commands = useMemo<Command[]>(() => {
    const nav: Command[] = Object.entries(NAV_KEYS).map(([k, v]) => ({
      id: `nav-${k}`, title: `Go to ${v.label}`, group: "Navigate", keys: ["G", k.toUpperCase()], run: () => router.push(v.href),
    }));
    const actions: Command[] = [
      { id: "quick", title: "Quick add a task or link…", group: "Actions", keys: ["C"], keywords: "new task deadline", run: () => setOpen("quickadd") },
      { id: "new-opp", title: "New opportunity", group: "Actions", keywords: "add application", run: () => router.push("/app/pipeline?new=1") },
      {
        id: "sync", title: "Sync Gmail now", group: "Actions", keywords: "refresh fetch",
        run: async () => {
          const r = await fetch("/api/sync", { method: "POST" });
          const j = await r.json().catch(() => ({}));
          push({ message: r.ok ? `Synced${typeof j.added === "number" ? ` · ${j.added} new` : ""}` : j.error ?? "Sync failed", tone: r.ok ? undefined : "error" });
          router.refresh();
        },
      },
      { id: "dormant", title: "Mark stale as dormant (60+ days quiet)", group: "Actions", keywords: "zero cleanup backlog", run: () => { act(() => markStaleDormant(60)); } },
      { id: "pause", title: "Pause notifications for a week", group: "Actions", keywords: "quiet digest mute", run: () => { act(() => pauseNotifications(7)); } },
      { id: "keys", title: "Keyboard shortcuts", group: "Help", keys: ["?"], run: () => setSheet(true) },
    ];
    const oppCmds: Command[] = opps.map((o) => {
      const order = ["interested", "applied", "assessment", "interview", "offer"];
      const next = order[order.indexOf(o.stage) + 1];
      return {
        id: `opp-${o.id}`,
        title: o.org,
        hint: [o.role, STAGE_STYLE[o.stage]?.label].filter(Boolean).join(" · "),
        group: "Opportunities",
        keywords: `${o.role ?? ""} ${o.stage}`,
        run: () => router.push(`/app/o/${o.id}`),
        secondary: next ? { title: `Move to ${STAGE_STYLE[next].label}`, run: () => { act(() => setStage(o.id, next)); } } : undefined,
        tertiary: { title: "Archive", run: () => { act(() => archiveOpportunity(o.id, true)); } },
      };
    });
    return [...(scope ?? []), ...actions, ...nav, ...oppCmds];
  }, [opps, scope, router, act, push]);

  return (
    <Shell.Provider value={{ openPalette, setScope }}>
      {children}
      {open && (
        <Palette
          mode={open}
          commands={commands}
          onClose={() => setOpen(null)}
          onQuickAdd={async (text) => {
            const r = await act(() => quickAdd(text));
            if (r && !r.error) setOpen(null);
          }}
        />
      )}
      {sheet && <ShortcutSheet onClose={() => setSheet(false)} />}
    </Shell.Provider>
  );
}

/** J/K move between [data-nav-item]s; other keys click the selected item's [data-key] button. */
function listKey(e: KeyboardEvent) {
  const items = Array.from(document.querySelectorAll<HTMLElement>("[data-nav-item]")).filter((el) => el.offsetParent !== null);
  if (!items.length) return;
  const cur = items.findIndex((el) => el.dataset.selected === "true");
  const select = (i: number) => {
    items.forEach((el) => (el.dataset.selected = "false"));
    const el = items[Math.max(0, Math.min(items.length - 1, i))];
    el.dataset.selected = "true";
    el.scrollIntoView({ block: "nearest" });
    el.focus({ preventScroll: true });
  };
  const k = e.key.toLowerCase();
  if (k === "j" || e.key === "ArrowDown" && cur >= 0) { e.preventDefault(); select(cur + 1); return; }
  if (k === "k" || e.key === "ArrowUp" && cur >= 0) { e.preventDefault(); select(cur < 0 ? 0 : cur - 1); return; }
  if (e.key === "Escape" && cur >= 0) { items[cur].dataset.selected = "false"; (document.activeElement as HTMLElement)?.blur(); return; }
  // Item keys apply to the selected item, or the first one when nothing is selected (Review is one-at-a-time).
  const target = cur >= 0 ? items[cur] : items.length === 1 || items[0].closest("[data-single]") ? items[0] : null;
  if (!target) return;
  const keyName = e.key === "Enter" ? "enter" : e.key === "Backspace" || e.key === "Delete" ? "del" : k;
  const btn = target.querySelector<HTMLElement>(`[data-key="${keyName}"]`);
  if (btn) {
    e.preventDefault();
    btn.click();
    // Advance: the acted-on item usually disappears; keep the selection at the same index.
    if (["e", "h", "del", "1", "2"].includes(keyName)) setTimeout(() => {
      const next = Array.from(document.querySelectorAll<HTMLElement>("[data-nav-item]")).filter((el) => el.offsetParent !== null);
      const n = next[Math.min(cur < 0 ? 0 : cur, next.length - 1)];
      if (n && cur >= 0) { next.forEach((el) => (el.dataset.selected = "false")); n.dataset.selected = "true"; }
    }, 350);
  }
}

function score(c: Command, q: string): number {
  if (!q) return 1;
  const hay = `${c.title} ${c.hint ?? ""} ${c.keywords ?? ""}`.toLowerCase();
  const t = c.title.toLowerCase();
  if (t.startsWith(q)) return 3;
  if (t.includes(q)) return 2;
  return q.split(/\s+/).every((w) => hay.includes(w)) ? 1 : 0;
}

function Palette({
  mode, commands, onClose, onQuickAdd,
}: {
  mode: "commands" | "quickadd" | "search";
  commands: Command[];
  onClose: () => void;
  onQuickAdd: (text: string) => Promise<void>;
}) {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => input.current?.focus(), []);

  const results = useMemo(() => {
    if (mode === "quickadd") return [];
    const pool = mode === "search" ? commands.filter((c) => c.group === "Opportunities") : commands;
    const query = q.trim().toLowerCase();
    if (!query && mode === "commands") return pool.filter((c) => c.group !== "Opportunities").slice(0, 14);
    return pool.map((c) => ({ c, s: score(c, query) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s).slice(0, 30).map((x) => x.c);
  }, [q, commands, mode]);

  const run = async (c: Command | undefined, which: "primary" | "secondary" | "tertiary" = "primary") => {
    if (!c) return;
    const r = which === "secondary" ? c.secondary : which === "tertiary" ? c.tertiary : c;
    if (!r) return;
    onClose();
    await r.run();
  };

  const onKey = async (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { e.preventDefault(); onClose(); return; }
    if (mode === "quickadd") {
      if (e.key === "Enter" && q.trim()) {
        e.preventDefault();
        setBusy(true);
        await onQuickAdd(q);
        setBusy(false);
      }
      return;
    }
    if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(results.length - 1, s + 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
    if (e.key === "Enter") {
      e.preventDefault();
      run(results[sel], e.metaKey || e.ctrlKey ? "secondary" : e.altKey ? "tertiary" : "primary");
    }
  };

  let lastGroup = "";
  const active = results[sel];
  return (
    <div className="animate-fade fixed inset-0 z-50 bg-black/30" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={mode === "quickadd" ? "Quick add" : "Command palette"}
        className="float animate-pop mx-auto mt-[12vh] w-[min(620px,calc(100vw-24px))] overflow-hidden rounded-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-line px-4">
          <input
            ref={input}
            value={q}
            onChange={(e) => { setQ(e.target.value); setSel(0); }}
            onKeyDown={onKey}
            disabled={busy}
            role="combobox"
            aria-expanded={results.length > 0}
            aria-controls="palette-list"
            aria-activedescendant={active ? `pc-${active.id}` : undefined}
            placeholder={mode === "quickadd" ? "Rhodes essay due Nov 20 · or paste a job link" : mode === "search" ? "Search opportunities…" : "Type a command or search…"}
            className="h-13 w-full bg-transparent text-[15px] outline-none placeholder:text-muted"
          />
          <span className="kbd">esc</span>
        </div>
        {mode === "quickadd" ? (
          <div className="px-4 py-3 text-[13px] text-muted">
            Press <span className="kbd">↵</span> to add. Dates like “Friday”, “Nov 20” or “in 3 days” become the due date; a link becomes an Interested opportunity.
          </div>
        ) : (
          <ul id="palette-list" role="listbox" className="max-h-[52vh] overflow-y-auto p-1.5">
            {results.length === 0 && <li className="px-3 py-6 text-center text-[13px] text-muted">No results for “{q}”</li>}
            {results.map((c, i) => {
              const header = c.group !== lastGroup ? (lastGroup = c.group) : null;
              return (
                <li key={c.id} role="presentation">
                  {header && <p className="eyebrow px-2.5 pb-1 pt-2.5">{header}</p>}
                  <div
                    id={`pc-${c.id}`}
                    role="option"
                    aria-selected={i === sel}
                    onMouseMove={() => setSel(i)}
                    onClick={() => run(c)}
                    className={`flex h-10 cursor-pointer items-center gap-3 rounded-md px-2.5 text-[14px] ${i === sel ? "bg-hover" : ""}`}
                  >
                    <span className="min-w-0 flex-1 truncate">
                      {c.title}
                      {c.hint && <span className="ml-2 text-[13px] text-muted">{c.hint}</span>}
                    </span>
                    {c.keys && <span className="flex gap-1">{c.keys.map((k) => <span key={k} className="kbd">{k}</span>)}</span>}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {mode !== "quickadd" && active && (active.secondary || active.tertiary) && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-line px-4 py-2 text-[12px] text-muted">
            <span><span className="kbd">↵</span> Open</span>
            {active.secondary && <span><span className="kbd">⌘</span><span className="kbd">↵</span> {active.secondary.title}</span>}
            {active.tertiary && <span><span className="kbd">⌥</span><span className="kbd">↵</span> {active.tertiary.title}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

const SHEET: [string, string[][]][] = [
  ["Anywhere", [["⌘", "K"], ["G", "T"], ["G", "P"], ["G", "R"], ["G", "O"], ["G", "I"], ["G", "S"], ["C"], ["/"], ["?"], ["Z"]]],
  ["Lists", [["J"], ["K"], ["↵"], ["E"], ["H"], ["D"], ["M"], ["⌫"], ["esc"]]],
  ["Review", [["1"], ["2"], ["3"], ["H"], ["E"]]],
];
const SHEET_LABEL: Record<string, string> = {
  "⌘K": "Command palette", GT: "Go to Today", GP: "Go to Pipeline", GR: "Go to Review", GO: "Go to People", GI: "Go to Insights", GS: "Go to Settings",
  C: "Quick add", "/": "Search opportunities", "?": "This sheet", Z: "Undo",
  J: "Next item", K: "Previous item", "↵": "Open", E: "Done / archive", H: "Snooze", D: "Open draft", M: "Move stage", "⌫": "Delete (with undo)", esc: "Clear selection",
  "1": "Track as new", "2": "Not an application", "3": "Attach to existing", "Review:H": "Snooze", "Review:E": "Accept suggestion",
};

function ShortcutSheet({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="animate-fade fixed inset-0 z-50 grid place-items-center bg-black/30 p-3" onMouseDown={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Keyboard shortcuts" className="float animate-pop w-[min(720px,100%)] rounded-xl p-6" onMouseDown={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="h-section">Keyboard shortcuts</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close">esc</button>
        </div>
        <div className="grid gap-6 sm:grid-cols-3">
          {SHEET.map(([group, rows]) => (
            <div key={group}>
              <p className="eyebrow mb-2">{group}</p>
              <ul className="space-y-1.5 text-[13px]">
                {rows.map((keys) => {
                  const id = keys.join("");
                  const label = (group === "Review" && SHEET_LABEL[`Review:${id}`]) || SHEET_LABEL[id];
                  return (
                    <li key={id} className="flex items-center justify-between gap-3">
                      <span className="text-ink-2">{label}</span>
                      <span className="flex gap-1">{keys.map((k) => <span key={k} className="kbd">{k}</span>)}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export type { Command };
