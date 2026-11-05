import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { NewOppButton } from "@/components/dialogs";
import { isDormant, listOpportunities } from "@/lib/data";
import { db } from "@/lib/db";
import type { Opportunity } from "@/lib/types";
import { ActionButton } from "@/components/action-button";
import { Inferred, OrgAvatar, STAGE_STYLE, TYPE_LABEL } from "@/components/badges";
import { StageMenu } from "@/components/stage-select";
import { markStaleDormant } from "../actions";

export const metadata = { title: "Pipeline" };

const COLUMNS = ["interested", "applied", "assessment", "interview", "offer"];

function ago(iso: string | null) {
  if (!iso) return "";
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400_000);
  return d <= 0 ? "today" : d === 1 ? "1d" : d < 60 ? `${d}d` : `${Math.floor(d / 30)}mo`;
}

const fmtDue = (due: string) => new Date(due + "T12:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

/** Role and type are shown muted with a mail glyph until you confirm or edit them. */
function Field({ o, children }: { o: Opportunity; children: React.ReactNode }) {
  return o.confirmed || o.manual_stage ? <>{children}</> : <Inferred>{children}</Inferred>;
}

function DueLine({ due, today }: { due?: string; today: string }) {
  if (!due) return null;
  const urgent = new Date(due + "T12:00:00Z").getTime() - new Date(today + "T12:00:00Z").getTime() <= 86400_000;
  return <span className={`tabular text-[12px] ${urgent ? "font-medium text-danger" : "text-muted"}`}>{due < today ? "Overdue" : "Due"} {fmtDue(due)}</span>;
}

function Card({ o, due, today }: { o: Opportunity; due?: string; today: string }) {
  return (
    <li data-nav-item="" tabIndex={-1} className="card relative p-3 outline-none transition-colors hover:border-line-strong" style={{ viewTransitionName: `opp-${o.id}` }}>
      <div className="flex items-start gap-2.5">
        <OrgAvatar org={o.org} size={28} />
        <div className="min-w-0 flex-1">
          <Link data-key="enter" href={`/app/o/${o.id}`} className="block truncate text-[14px] font-medium after:absolute after:inset-0 after:content-['']">{o.org}</Link>
          <p className="line-clamp-2 text-[12px] text-muted"><Field o={o}>{o.role ?? "Role not detected"}</Field></p>
        </div>
      </div>
      <div className="relative z-10 mt-2.5 flex items-center justify-between gap-2">
        <StageMenu oppId={o.id} stage={o.stage} outcome={o.outcome} />
        <span className="tabular text-[12px] text-muted" title="Last activity">{ago(o.last_activity_at ?? o.created_at)}</span>
      </div>
      {due && <p className="mt-1.5"><DueLine due={due} today={today} /></p>}
    </li>
  );
}

function Row({ o, due, today }: { o: Opportunity; due?: string; today: string }) {
  return (
    <li data-nav-item="" tabIndex={-1} className="row-hover relative grid min-h-11 grid-cols-[1fr_auto] items-center gap-x-3 px-3 py-1.5 outline-none sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1.3fr)_7rem_8.5rem_4rem_6rem]">
      <span className="flex min-w-0 items-center gap-2.5">
        <OrgAvatar org={o.org} size={24} />
        <Link data-key="enter" href={`/app/o/${o.id}`} className="truncate text-[14px] font-medium after:absolute after:inset-0 after:content-['']">{o.org}</Link>
      </span>
      <span className="hidden min-w-0 truncate text-[13px] text-muted sm:block"><Field o={o}>{o.role ?? "—"}</Field></span>
      <span className="hidden text-[13px] text-muted sm:block">{TYPE_LABEL[o.type] ?? o.type}</span>
      <span className="relative z-10"><StageMenu oppId={o.id} stage={o.stage} outcome={o.outcome} /></span>
      <span className="tabular hidden text-right text-[12px] text-muted sm:block">{ago(o.last_activity_at ?? o.created_at)}</span>
      <span className="hidden text-right sm:block"><DueLine due={due} today={today} /></span>
    </li>
  );
}

export default async function PipelinePage({ searchParams }: { searchParams: Promise<{ type?: string; closed?: string; view?: string; new?: string }> }) {
  const user = await requireUser();
  const { type, closed, view, new: openNew } = await searchParams;
  const opps = listOpportunities(user.id, { type: type && TYPE_LABEL[type] ? type : undefined });
  const nextTask = new Map(
    (db
      .prepare(`SELECT opportunity_id, MIN(due_at) AS due FROM tasks WHERE user_id = ? AND done = 0 AND deleted_at IS NULL AND due_at IS NOT NULL GROUP BY opportunity_id`)
      .all(user.id) as { opportunity_id: string; due: string }[]).map((r) => [r.opportunity_id, r.due]),
  );
  const counts = db.prepare(`SELECT type, COUNT(*) n FROM opportunities WHERE user_id = ? AND archived = 0 AND deleted_at IS NULL GROUP BY type`).all(user.id) as { type: string; n: number }[];
  const closedOpps = opps.filter((o) => o.stage === "closed");
  const dormant = opps.filter((o) => isDormant(o));
  const dormantIds = new Set(dormant.map((o) => o.id));
  const active = opps.filter((o) => o.stage !== "closed" && !dormantIds.has(o.id));
  const quiet60 = active.filter((o) => new Date(o.last_activity_at ?? o.applied_at ?? o.created_at).getTime() < Date.now() - 60 * 86400_000).length + dormant.length;
  const today = new Date().toISOString().slice(0, 10);
  const q = (extra: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const all = { type, view, ...extra };
    for (const [k, v] of Object.entries(all)) if (v) p.set(k, v);
    const s = p.toString();
    return `/app/pipeline${s ? `?${s}` : ""}`;
  };
  // Mobile defaults to the list; desktop to the board. An explicit choice applies everywhere.
  const boardCls = view === "list" ? "hidden" : view === "board" ? "" : "hidden md:block";
  const listCls = view === "board" ? "hidden" : view === "list" ? "" : "md:hidden";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="h-page">Pipeline</h1>
          <p className="tabular mt-1 text-[14px] text-muted">{active.length} active · {dormant.length} dormant · {closedOpps.length} closed</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border border-line p-0.5" role="group" aria-label="View">
            <Link href={q({ view: "board" })} aria-current={view !== "list" ? "true" : undefined} className={`rounded-[5px] px-2.5 py-1 text-[13px] font-medium ${view === "list" ? "text-muted" : view === "board" ? "bg-hover" : "text-muted md:bg-hover md:text-ink"}`}>Board</Link>
            <Link href={q({ view: "list" })} aria-current={view === "list" ? "true" : undefined} className={`rounded-[5px] px-2.5 py-1 text-[13px] font-medium ${view === "list" ? "bg-hover" : view === "board" ? "text-muted" : "bg-hover md:bg-transparent md:text-muted"}`}>List</Link>
          </div>
          <NewOppButton autoOpen={openNew === "1"} />
        </div>
      </div>

      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1" aria-label="Filter by type">
        <Link href={q({ type: undefined })} aria-current={!type ? "true" : undefined} className={`chip h-7 shrink-0 px-2.5 ${!type ? "border-ink bg-ink text-bg" : ""}`}>All</Link>
        {counts.map((c) => (
          <Link key={c.type} href={q({ type: c.type })} aria-current={type === c.type ? "true" : undefined} className={`chip h-7 shrink-0 px-2.5 ${type === c.type ? "border-ink bg-ink text-bg" : ""}`}>
            {TYPE_LABEL[c.type] ?? c.type} <span className="tabular opacity-60">{c.n}</span>
          </Link>
        ))}
      </div>

      <div className={boardCls}>
        <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
          <div className="grid min-w-[1040px] grid-cols-5 gap-3">
            {COLUMNS.map((stage) => {
              const list = active.filter((o) => o.stage === stage);
              const s = STAGE_STYLE[stage];
              return (
                <section key={stage} className="flex min-h-48 flex-col rounded-lg bg-sunken p-1.5" aria-label={s.label}>
                  <h2 className="flex items-center gap-2 px-1.5 pb-2 pt-1 text-[13px] font-medium">
                    {s.label}
                    <span className="tabular text-muted">{list.length}</span>
                  </h2>
                  <ul className="space-y-1.5">
                    {list.map((o) => <Card key={o.id} o={o} due={nextTask.get(o.id)} today={today} />)}
                    {!list.length && <li className="px-2 py-6 text-center text-[12px] text-muted">Nothing here</li>}
                  </ul>
                </section>
              );
            })}
          </div>
        </div>
      </div>

      <div className={listCls}>
        {COLUMNS.map((stage) => {
          const list = active.filter((o) => o.stage === stage);
          if (!list.length) return null;
          return (
            <section key={stage} className="mb-4" aria-label={STAGE_STYLE[stage].label}>
              <h2 className="flex items-center gap-2 px-1 pb-1.5 text-[13px] font-medium">{STAGE_STYLE[stage].label} <span className="tabular text-muted">{list.length}</span></h2>
              <ul className="card divide-y divide-line overflow-visible">
                {list.map((o) => <Row key={o.id} o={o} due={nextTask.get(o.id)} today={today} />)}
              </ul>
            </section>
          );
        })}
      </div>

      {quiet60 > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line px-4 py-3">
          <p className="text-[14px] text-ink-2">
            <span className="tabular font-medium text-ink">{quiet60}</span> {quiet60 === 1 ? "application has" : "applications have"} been quiet for 60+ days. Clear them in one step; you can undo.
          </p>
          <ActionButton action={markStaleDormant} pendingText="Clearing…">Mark stale as dormant</ActionButton>
        </div>
      )}

      {dormant.length > 0 && (
        <section className="card">
          <details>
            <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-[14px]">
              <span className="font-medium">Dormant <span className="font-normal text-muted">· no news in 4+ months</span></span>
              <span className="tabular text-muted">{dormant.length}</span>
            </summary>
            <ul className="divide-y divide-line border-t border-line">{dormant.map((o) => <Row key={o.id} o={o} today={today} />)}</ul>
          </details>
        </section>
      )}

      <section className="card">
        <details open={closed === "1"}>
          <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-[14px] font-medium">
            Closed <span className="tabular font-normal text-muted">{closedOpps.length}</span>
          </summary>
          <ul className="divide-y divide-line border-t border-line">{closedOpps.map((o) => <Row key={o.id} o={o} today={today} />)}</ul>
        </details>
      </section>
    </div>
  );
}
