import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { NewOppButton } from "@/components/dialogs";
import { today as todayData } from "@/lib/data";
import { db } from "@/lib/db";
import { draftFollowUp, gmailComposeUrl } from "@/lib/followups";
import { gmailLink } from "@/lib/urls";
import { zonedDate, zonedParts, formatDay } from "@/lib/time";
import { AutoRefresh } from "@/components/auto-refresh";
import { OrgAvatar, StageBadge } from "@/components/badges";
import { FollowUpCard } from "@/components/followup-card";
import { ChevronRight, MailIcon, SendIcon } from "@/components/icons";
import { SyncButton } from "@/components/sync-button";
import { TaskItem } from "@/components/task-item";

export const metadata = { title: "Today" };

const KIND_LABEL: Record<string, string> = {
  received: "Application received", assessment: "Assessment", assessment_done: "Assessment submitted",
  interview: "Interview", offer: "Offer", rejection: "Not moving forward", info_request: "Information requested",
};

function ago(iso: string) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400_000);
  return d <= 0 ? "today" : d === 1 ? "yesterday" : `${d}d ago`;
}

export default async function TodayPage() {
  const user = await requireUser();
  const t = todayData(user);
  const now = new Date();
  const todayStr = zonedDate(now, user.timezone);
  const hour = zonedParts(now, user.timezone).hour;
  const gmail = db.prepare(`SELECT email, backfill_state, last_sync_at, last_error FROM google_accounts WHERE user_id = ?`).get(user.id) as
    | { email: string; backfill_state: string; last_sync_at: string | null; last_error: string | null }
    | undefined;
  const { n: oppCount } = db.prepare(`SELECT COUNT(*) n FROM opportunities WHERE user_id = ?`).get(user.id) as { n: number };
  const { n: openCount } = db.prepare(`SELECT COUNT(*) n FROM opportunities WHERE user_id = ? AND archived = 0 AND stage NOT IN ('closed')`).get(user.id) as { n: number };
  const backfilling = gmail && gmail.backfill_state !== "done";
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const needs = [...t.overdue, ...t.dueSoon];

  return (
    <div className="space-y-8">
      <AutoRefresh active={Boolean(backfilling)} ms={4000} />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">{formatDay(todayStr)}</p>
          <h1 className="h-display mt-1 text-3xl sm:text-[2.1rem]">{greeting}, {user.name.split(" ")[0]}.</h1>
          <p className="mt-1 text-ink-2">
            {needs.length + t.followUps.length === 0
              ? "Nothing urgent. Nice."
              : `${needs.length} ${needs.length === 1 ? "thing" : "things"} due, ${t.followUps.length} ${t.followUps.length === 1 ? "follow-up" : "follow-ups"} owed.`}
          </p>
        </div>
        <div className="flex gap-2">
          {gmail && <SyncButton />}
          <NewOppButton />
        </div>
      </div>

      {backfilling && (
        <div className="flex items-center gap-3 rounded-xl border border-accent/30 bg-accent-soft p-4 text-sm">
          <MailIcon className="shrink-0 animate-pulse-soft text-accent" />
          <p><strong>Reading your Gmail…</strong> Pursuit is going through the last 6 months of application email. Opportunities appear here as they&apos;re found.</p>
        </div>
      )}
      {gmail?.last_error && !backfilling && (
        <p className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">Gmail sync problem: {gmail.last_error} <Link className="underline" href="/app/settings">Settings</Link></p>
      )}

      {oppCount === 0 && !backfilling ? (
        <div className="card p-8 text-center sm:p-12">
          <h2 className="h-display text-2xl">Let&apos;s build your pipeline</h2>
          <p className="mx-auto mt-2 max-w-md text-ink-2">Connect Gmail (read-only) and Pursuit finds every application, interview and rejection from the last six months — or add one by hand.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Link href="/app/settings" className="btn btn-primary">Connect Gmail</Link>
            <Link href="/app/settings#import" className="btn btn-secondary">Import or forward email</Link>
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { label: "Open applications", value: openCount, href: "/app/pipeline" },
              { label: "Due this week", value: needs.length, tone: t.overdue.length ? "danger" : undefined },
              { label: "Follow-ups owed", value: t.followUps.length },
              { label: "To review", value: t.review, href: "/app/review" },
            ].map((s) => {
              const inner = (
                <>
                  <p className="text-[13px] text-muted">{s.label}</p>
                  <p className={`mt-1 text-[1.9rem] font-bold leading-none tracking-tight ${s.tone === "danger" ? "text-danger" : ""}`}>{s.value}</p>
                </>
              );
              return s.href ? (
                <Link key={s.label} href={s.href} className="card p-4 transition-shadow hover:shadow-md">{inner}</Link>
              ) : (
                <div key={s.label} className="card p-4">{inner}</div>
              );
            })}
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.25fr_1fr]">
            <div className="min-w-0 space-y-6">
              <section className="card p-5">
                <div className="flex items-baseline justify-between">
                  <h2 className="font-semibold">Needs you</h2>
                  {t.overdue.length > 0 && <span className="text-sm font-semibold text-danger">{t.overdue.length} overdue</span>}
                </div>
                {needs.length ? (
                  <ul className="mt-2 divide-y divide-line">
                    {needs.map((x) => <TaskItem key={x.id} task={x} today={todayStr} />)}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm text-muted">No deadlines in the next 7 days.</p>
                )}
                {t.later.length > 0 && <p className="mt-3 text-xs text-muted">+ {t.later.length} later or undated</p>}
              </section>

              <section>
                <div className="mb-3 flex items-center gap-2">
                  <SendIcon size={17} className="text-muted" />
                  <h2 className="font-semibold">Follow-ups you owe</h2>
                  <span className="text-sm text-muted">· no reply after {user.followup_days}+ days</span>
                </div>
                {t.followUps.length ? (
                  <ul className="space-y-2.5">
                    {t.followUps.slice(0, 8).map((f) => {
                      const d = draftFollowUp(f, user.name);
                      return <FollowUpCard key={f.threadId} f={f} draft={d} composeUrl={gmailComposeUrl(f.to, d.subject, d.body)} threadUrl={gmailLink(f.threadId)} />;
                    })}
                  </ul>
                ) : (
                  <p className="rounded-xl border border-dashed border-line-strong p-5 text-sm text-muted">Nobody is waiting on you. {gmail ? "" : "Connect Gmail so Pursuit can see your sent mail."}</p>
                )}
              </section>
            </div>

            <div className="min-w-0 space-y-6">
              <section className="card p-5">
                <h2 className="font-semibold">What changed this week</h2>
                {t.updates.length ? (
                  <ul className="mt-3 space-y-3">
                    {t.updates.slice(0, 8).map((e) => (
                      <li key={e.id}>
                        <Link href={`/app/o/${e.opportunity_id}`} className="group flex items-center gap-3">
                          <OrgAvatar org={e.org} size={32} />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold group-hover:text-accent">{e.org}</p>
                            <p className="truncate text-xs text-muted">{KIND_LABEL[e.kind] ?? e.summary} · {ago(e.at)}</p>
                          </div>
                          <StageBadge stage={e.stage} outcome={e.kind === "rejection" ? "rejected" : undefined} />
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm text-muted">No news in the last 7 days.</p>
                )}
              </section>

              {t.asks.length > 0 && (
                <section className="card p-5">
                  <div className="flex items-baseline justify-between">
                    <h2 className="font-semibold">Waiting on others</h2>
                    <Link href="/app/people" className="text-sm text-muted hover:text-accent">People</Link>
                  </div>
                  <ul className="mt-3 space-y-2.5 text-sm">
                    {t.asks.slice(0, 6).map((a) => (
                      <li key={a.id} className="flex items-center justify-between gap-3">
                        <span className="min-w-0 truncate"><strong>{a.person_name}</strong> <span className="text-muted">· {a.kind}{a.org ? ` for ${a.org}` : ""}</span></span>
                        <span className="chip shrink-0 capitalize">{a.status.replace("_", " ")}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {t.stale.length > 0 && (
                <section className="card p-5">
                  <h2 className="font-semibold">Gone quiet</h2>
                  <p className="text-xs text-muted">No news for {user.stale_days}+ days. Chase, or close them out.</p>
                  <ul className="mt-3 space-y-2">
                    {t.stale.slice(0, 6).map((o) => (
                      <li key={o.id}>
                        <Link href={`/app/o/${o.id}`} className="group flex items-center justify-between gap-3 text-sm">
                          <span className="min-w-0 truncate"><strong className="group-hover:text-accent">{o.org}</strong> <span className="text-muted">{o.role ? `· ${o.role}` : ""}</span></span>
                          <span className="flex shrink-0 items-center gap-1 text-xs text-muted">{ago(o.last_inbound_at ?? o.applied_at ?? o.created_at)} <ChevronRight size={14} /></span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
