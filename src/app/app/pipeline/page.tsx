import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { NewOppButton } from "@/components/dialogs";
import { isDormant, listOpportunities } from "@/lib/data";
import { db } from "@/lib/db";
import { OrgAvatar, STAGE_STYLE, StageBadge, TYPE_LABEL, TypeChip } from "@/components/badges";
import { StageSelect } from "@/components/stage-select";

export const metadata = { title: "Pipeline" };

const COLUMNS = ["interested", "applied", "assessment", "interview", "offer"];

function ago(iso: string | null) {
  if (!iso) return "";
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400_000);
  return d <= 0 ? "today" : d === 1 ? "1d" : d < 60 ? `${d}d` : `${Math.floor(d / 30)}mo`;
}

export default async function PipelinePage({ searchParams }: { searchParams: Promise<{ type?: string; closed?: string }> }) {
  const user = await requireUser();
  const { type, closed } = await searchParams;
  const opps = listOpportunities(user.id, { type: type && TYPE_LABEL[type] ? type : undefined });
  const nextTask = new Map(
    (db
      .prepare(`SELECT opportunity_id, MIN(due_at) AS due FROM tasks WHERE user_id = ? AND done = 0 AND due_at IS NOT NULL GROUP BY opportunity_id`)
      .all(user.id) as { opportunity_id: string; due: string }[]).map((r) => [r.opportunity_id, r.due]),
  );
  const counts = db.prepare(`SELECT type, COUNT(*) n FROM opportunities WHERE user_id = ? AND archived = 0 GROUP BY type`).all(user.id) as { type: string; n: number }[];
  const closedOpps = opps.filter((o) => o.stage === "closed");
  const dormant = opps.filter((o) => isDormant(o));
  const dormantIds = new Set(dormant.map((o) => o.id));
  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="h-display text-3xl">Pipeline</h1>
          <p className="mt-1 text-ink-2">{opps.length - closedOpps.length - dormant.length} active · {dormant.length} dormant · {closedOpps.length} closed</p>
        </div>
        <NewOppButton />
      </div>

      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1" aria-label="Filter by type">
        <Link href="/app/pipeline" className={`chip shrink-0 ${!type ? "border-ink bg-ink text-bg" : ""}`}>All</Link>
        {counts.map((c) => (
          <Link key={c.type} href={`/app/pipeline?type=${c.type}`} className={`chip shrink-0 ${type === c.type ? "border-ink bg-ink text-bg" : ""}`}>
            {TYPE_LABEL[c.type] ?? c.type} <span className="opacity-60">{c.n}</span>
          </Link>
        ))}
      </div>

      <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
        <div className="grid min-w-[1040px] grid-cols-5 gap-3">
          {COLUMNS.map((stage) => {
            const list = opps.filter((o) => o.stage === stage && !dormantIds.has(o.id));
            const s = STAGE_STYLE[stage];
            return (
              <section key={stage} className="flex min-h-48 flex-col rounded-xl bg-sunken/70 p-2" aria-label={s.label}>
                <h2 className="flex items-center gap-2 px-1.5 pb-2 pt-1 text-sm font-semibold">
                  <span className="size-2 rounded-full" style={{ background: s.color }} />
                  {s.label}
                  <span className="text-muted">{list.length}</span>
                </h2>
                <ul className="space-y-2">
                  {list.map((o) => {
                    const due = nextTask.get(o.id);
                    return (
                      <li key={o.id}>
                        <Link href={`/app/o/${o.id}`} className="block rounded-lg border border-line bg-surface p-3 shadow-sm transition-shadow hover:shadow-md">
                          <div className="flex items-start gap-2.5">
                            <OrgAvatar org={o.org} size={30} />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold">{o.org}</p>
                              <p className="line-clamp-2 text-xs text-muted">{o.role ?? "—"}</p>
                            </div>
                          </div>
                          <div className="mt-2.5 flex items-center justify-between gap-2">
                            <TypeChip type={o.type} />
                            <span className="text-[11px] text-muted" title="Last activity">{ago(o.last_activity_at ?? o.created_at)}</span>
                          </div>
                          {due && (
                            <p className={`mt-2 text-[11px] font-semibold ${due < todayStr ? "text-danger" : "text-honey"}`}>
                              {due < todayStr ? "Overdue" : "Due"} {new Date(due + "T12:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                            </p>
                          )}
                        </Link>
                      </li>
                    );
                  })}
                  {!list.length && <li className="px-2 py-6 text-center text-xs text-muted">Nothing here</li>}
                </ul>
              </section>
            );
          })}
        </div>
      </div>

      {dormant.length > 0 && (
        <section className="card">
          <details>
            <summary className="flex cursor-pointer list-none items-center justify-between p-4">
              <span className="font-semibold">Dormant <span className="font-normal text-muted">· no news in 4+ months — most of these are silent rejections</span></span>
              <span className="text-sm text-muted">{dormant.length}</span>
            </summary>
            <ul className="divide-y divide-line border-t border-line">
              {dormant.map((o) => (
                <li key={o.id} className="flex items-center gap-3 px-4 py-2.5">
                  <OrgAvatar org={o.org} size={28} />
                  <Link href={`/app/o/${o.id}`} className="min-w-0 flex-1 truncate hover:text-accent">
                    <span className="text-sm font-semibold">{o.org}</span> <span className="text-sm text-muted">{o.role ?? ""}</span>
                  </Link>
                  <span className="hidden text-xs text-muted sm:inline">{ago(o.last_activity_at ?? o.applied_at ?? o.created_at)} ago</span>
                  <StageSelect oppId={o.id} stage={o.stage} outcome={o.outcome} compact />
                </li>
              ))}
            </ul>
          </details>
        </section>
      )}

      <section className="card">
        <details open={closed === "1"}>
          <summary className="flex cursor-pointer list-none items-center justify-between p-4 font-semibold">
            Closed <span className="text-sm font-normal text-muted">{closedOpps.length}</span>
          </summary>
          <ul className="divide-y divide-line border-t border-line">
            {closedOpps.map((o) => (
              <li key={o.id} className="flex items-center gap-3 px-4 py-2.5">
                <OrgAvatar org={o.org} size={28} />
                <Link href={`/app/o/${o.id}`} className="min-w-0 flex-1 hover:text-accent">
                  <span className="text-sm font-semibold">{o.org}</span> <span className="text-sm text-muted">{o.role ?? ""}</span>
                </Link>
                <StageBadge stage={o.stage} outcome={o.outcome} />
                <StageSelect oppId={o.id} stage={o.stage} outcome={o.outcome} compact />
              </li>
            ))}
          </ul>
        </details>
      </section>
    </div>
  );
}
