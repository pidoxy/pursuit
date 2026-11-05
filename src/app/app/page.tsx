import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { today as todayData } from "@/lib/data";
import { db } from "@/lib/db";
import { draftFollowUp, gmailComposeUrl } from "@/lib/followups";
import { gmailLink } from "@/lib/urls";
import { formatDay, zonedDate, zonedParts } from "@/lib/time";
import { AutoRefresh } from "@/components/auto-refresh";
import { OrgAvatar, StageBadge } from "@/components/badges";
import { FollowUpCard } from "@/components/followup-card";
import { ChevronRight, MailIcon } from "@/components/icons";
import { SyncButton } from "@/components/sync-button";
import { TaskItem } from "@/components/task-item";
import { ThanksDraft } from "@/components/people-drafts";

export const metadata = { title: "Today" };

const KIND_LABEL: Record<string, string> = {
  received: "Application received", assessment: "Assessment", assessment_done: "Assessment submitted",
  interview: "Interview", offer: "Offer", info_request: "Information requested",
};

/** Calm completion lines, one per day. No streaks. */
const DONE_LINES = [
  "That's everything for today. Pursuit will tell you when something needs you.",
  "Nothing needs you right now. Go do something else.",
  "All clear. New deadlines and replies will show up here on their own.",
  "Done for today. Waiting is part of the process.",
];

function ago(iso: string) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400_000);
  return d <= 0 ? "today" : d === 1 ? "yesterday" : `${d}d ago`;
}

function Section({ title, meta, children }: { title: string; meta?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section aria-label={title}>
      <div className="mb-1.5 flex items-baseline justify-between gap-3 border-b border-line pb-2">
        <h2 className="h-section">{title}</h2>
        {meta && <span className="text-[12px] text-muted">{meta}</span>}
      </div>
      {children}
    </section>
  );
}

export default async function TodayPage() {
  const user = await requireUser();
  const gmail = db.prepare(`SELECT email, backfill_state, last_sync_at, last_error FROM google_accounts WHERE user_id = ?`).get(user.id) as
    | { email: string; backfill_state: string; last_sync_at: string | null; last_error: string | null }
    | undefined;
  const { n: oppCount } = db.prepare(`SELECT COUNT(*) n FROM opportunities WHERE user_id = ? AND deleted_at IS NULL`).get(user.id) as { n: number };
  if (!user.onboarded && oppCount === 0 && !gmail) redirect("/app/connect");

  const t = todayData(user);
  const now = new Date();
  const todayStr = zonedDate(now, user.timezone);
  const hour = zonedParts(now, user.timezone).hour;
  const backfilling = gmail && gmail.backfill_state !== "done";
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const e = t.effort;
  const effortParts = [
    `${e.sent} sent`,
    e.followUpsSent ? `${e.followUpsSent} follow-up${e.followUpsSent === 1 ? "" : "s"} done` : null,
    e.tasksDone ? `${e.tasksDone} task${e.tasksDone === 1 ? "" : "s"} done` : null,
    e.applied ? `${e.applied} applied` : null,
  ].filter(Boolean);
  const waitingCount = t.asks.length + t.stale.length + t.submitted.length;
  const clear = t.queueSize === 0;

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <AutoRefresh active={Boolean(backfilling)} ms={4000} />
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow"><time dateTime={todayStr}>{formatDay(todayStr)}</time></p>
          <h1 className="h-page mt-1">{greeting}, {user.name.split(" ")[0]}.</h1>
          <p className="mt-1 text-[14px] text-muted">This week: {effortParts.join(", ")}.</p>
        </div>
        <div className="flex items-center gap-2">
          {gmail && <SyncButton />}
          <Link href="/app/review" className="btn btn-ghost btn-sm">
            {t.review ? <><span className="size-2 rounded-full bg-accent" aria-hidden /> Review</> : "Review"}
          </Link>
        </div>
      </header>

      {backfilling && (
        <div className="flex items-center gap-3 rounded-lg border border-line bg-surface px-4 py-3 text-[14px]">
          <MailIcon className="shrink-0 text-accent" size={18} />
          <p><span className="font-medium">Reading your Gmail…</span> Applications appear here as they&apos;re found.</p>
        </div>
      )}
      {gmail?.last_error && !backfilling && (
        <p className="rounded-lg border border-line bg-surface px-4 py-3 text-[14px] text-ink-2">
          Gmail sync stopped: {gmail.last_error} <Link className="text-accent underline" href="/app/settings">Fix in Settings</Link>
        </p>
      )}

      {oppCount === 0 && !backfilling ? (
        <div className="card px-6 py-12 text-center">
          <h2 className="h-section">Let&apos;s build your pipeline</h2>
          <p className="mx-auto mt-1 max-w-md text-[14px] text-muted">Connect Gmail (read-only) and Pursuit finds every application from the last six months, or try it with sample data first.</p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Link href="/app/connect" className="btn btn-primary">Get started</Link>
          </div>
        </div>
      ) : (
        <>
          {clear ? (
            <div className="card animate-fade px-6 py-10 text-center">
              <svg width="40" height="40" viewBox="0 0 40 40" className="mx-auto text-sage" aria-hidden>
                <circle cx="20" cy="20" r="17" fill="var(--sage-soft)" />
                <path d="m13 20.5 4.5 4.5L27 15.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <p className="h-section mt-3">Done for today</p>
              <p className="mx-auto mt-1 max-w-sm text-[14px] text-muted">{DONE_LINES[now.getUTCDate() % DONE_LINES.length]}</p>
            </div>
          ) : (
            <p className="text-[12px] text-muted max-sm:hidden">
              <span className="kbd">J</span> <span className="kbd">K</span> move · <span className="kbd">E</span> done · <span className="kbd">H</span> snooze · <span className="kbd">D</span> draft · <span className="kbd">Z</span> undo · <span className="kbd">C</span> quick add
            </p>
          )}

          {t.due.length > 0 && (
            <Section title="Due" meta={`${t.due.length} in the next 7 days`}>
              <ul>{t.due.map((x) => <TaskItem key={x.id} task={x} today={todayStr} />)}</ul>
            </Section>
          )}

          {t.followUps.length > 0 && (
            <Section title="Follow-ups you could send" meta={`no reply after ${user.followup_days}+ days`}>
              <ul>
                {t.followUps.slice(0, 8).map((f) => {
                  const d = draftFollowUp(f, user.name);
                  return <FollowUpCard key={f.threadId} f={f} draft={d} composeUrl={gmailComposeUrl(f.to, d.subject, d.body)} threadUrl={gmailLink(f.threadId)} />;
                })}
              </ul>
            </Section>
          )}

          {waitingCount > 0 && (
            <Section title="Waiting on others" meta={<Link href="/app/people" className="hover:text-accent">People</Link>}>
              <ul className="divide-y divide-line">
                {t.submitted.map((a) => (
                  <li key={a.id} className="py-2.5">
                    <p className="text-[14px]"><span className="font-medium">{a.person_name}</span> <span className="text-muted">submitted their letter{a.org ? ` for ${a.org}` : ""}.</span></p>
                    <ThanksDraft name={a.person_name} email={a.person_email} org={a.org} sender={user.name} />
                  </li>
                ))}
                {t.asks.slice(0, 6).map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 py-2.5 text-[14px]">
                    <span className="min-w-0 truncate"><span className="font-medium">{a.person_name}</span> <span className="text-muted">· {a.kind}{a.org ? ` for ${a.org}` : ""}</span></span>
                    <span className="chip shrink-0 capitalize">{a.status === "asked" ? "requested" : a.status === "agreed" ? "accepted" : a.status.replace("_", " ")}</span>
                  </li>
                ))}
                {t.stale.slice(0, 6).map((o) => (
                  <li key={o.id}>
                    <Link href={`/app/o/${o.id}`} className="row-hover -mx-2 flex items-center justify-between gap-3 rounded-md px-2 py-2.5 text-[14px]">
                      <span className="min-w-0 truncate"><span className="font-medium">{o.org}</span> <span className="text-muted">{o.role ? `· ${o.role}` : ""} · decision pending</span></span>
                      <span className="flex shrink-0 items-center gap-1 text-[12px] text-muted tabular">{ago(o.last_inbound_at ?? o.applied_at ?? o.created_at)} <ChevronRight size={14} /></span>
                    </Link>
                  </li>
                ))}
              </ul>
              {t.stale.length > 0 && <p className="mt-2 text-[12px] text-muted">Job searches have long quiet stretches. That&apos;s normal.</p>}
            </Section>
          )}

          {t.upcoming.length > 0 && (
            <details className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between border-b border-line pb-2">
                <span className="h-section">Upcoming</span>
                <span className="text-[12px] text-muted">{t.upcoming.length} later or undated · <span className="group-open:hidden">show</span><span className="hidden group-open:inline">hide</span></span>
              </summary>
              <ul className="mt-1">{t.upcoming.map((x) => <TaskItem key={x.id} task={x} today={todayStr} keyed={false} />)}</ul>
            </details>
          )}

          {t.updates.length > 0 && (
            <Section title="Recent activity">
              <ul>
                {t.updates.slice(0, 6).map((ev) => (
                  <li key={ev.id}>
                    <Link href={`/app/o/${ev.opportunity_id}`} className="row-hover -mx-2 flex items-center gap-3 rounded-md px-2 py-2">
                      <OrgAvatar org={ev.org} size={28} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px] font-medium">{ev.org}</p>
                        <p className="truncate text-[12px] text-muted">{KIND_LABEL[ev.kind] ?? ev.summary} · {ago(ev.at)}</p>
                      </div>
                      <StageBadge stage={ev.stage} />
                    </Link>
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </>
      )}
    </div>
  );
}
