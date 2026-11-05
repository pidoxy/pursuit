import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { AskButton, EditOppButton } from "@/components/dialogs";
import { getOpportunity } from "@/lib/data";
import { db } from "@/lib/db";
import { gmailLink } from "@/lib/urls";
import { zonedDate } from "@/lib/time";
import { ActionButton } from "@/components/action-button";
import { Inferred, OrgAvatar, TYPE_LABEL } from "@/components/badges";
import { AddTaskForm, NoteForm } from "@/components/forms";
import { ChevronLeft, ExternalIcon, MailIcon, SendIcon } from "@/components/icons";
import { AfterClosing, ConfirmButton, OppActions } from "@/components/opp-actions";
import { NudgeDraft } from "@/components/people-drafts";
import { StageMenu } from "@/components/stage-select";
import { TaskItem } from "@/components/task-item";
import { setAskStatus } from "../../actions";

export const metadata = { title: "Opportunity" };

const KIND: Record<string, { label: string; tone: string }> = {
  received: { label: "Application received", tone: "applied" },
  assessment: { label: "Assessment", tone: "assess" },
  assessment_done: { label: "Assessment submitted", tone: "assess" },
  interview: { label: "Interview", tone: "interview" },
  offer: { label: "Offer", tone: "offer" },
  rejection: { label: "Not moving forward", tone: "closed" },
  info_request: { label: "Information requested", tone: "assess" },
  update: { label: "Update", tone: "closed" },
  outbound: { label: "You wrote", tone: "closed" },
  note: { label: "Note", tone: "closed" },
};
const STAGE_KINDS = ["received", "assessment", "assessment_done", "interview", "offer", "rejection"];
const ASK_WORD: Record<string, string> = { to_ask: "to ask", asked: "requested", agreed: "accepted", submitted: "submitted", declined: "declined" };

const fmt = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
const fmtShort = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

export default async function OpportunityPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const data = getOpportunity(user.id, (await params).id);
  if (!data) notFound();
  const { opp, events, tasks, asks } = data;
  const people = db.prepare(`SELECT id, name FROM people WHERE user_id = ? AND deleted_at IS NULL ORDER BY name`).all(user.id) as { id: string; name: string }[];
  const today = zonedDate(new Date(), user.timezone);
  const stageIdx = ["applied", "assessment", "interview", "offer"].indexOf(opp.stage);
  const confirmed = Boolean(opp.confirmed || opp.manual_stage);
  // Provenance for the stage: the latest email that moved it.
  const stageEvent = events.find((e) => STAGE_KINDS.includes(e.kind) && e.message_id);
  const stageLink = stageEvent?.source === "gmail" ? gmailLink(stageEvent.thread_id, stageEvent.ext_id) : null;
  const nextTask = tasks.find((t) => !t.done);
  const contact = events.find((e) => e.direction === "in" && e.from_addr && !/no-?reply|notifications?/i.test(e.from_addr))?.from_addr ?? null;

  return (
    <div className="space-y-6">
      <Link href="/app/pipeline" className="inline-flex items-center gap-1 text-[13px] font-medium text-muted hover:text-ink"><ChevronLeft size={15} /> Pipeline</Link>

      <div className="flex flex-wrap items-start gap-4">
        <OrgAvatar org={opp.org} size={44} />
        <div className="min-w-0 flex-1">
          <h1 className="h-page">{opp.org}</h1>
          <p className="text-[14px] text-ink-2">{opp.role ? confirmed ? opp.role : <Inferred>{opp.role}</Inferred> : <span className="text-muted">Role not detected</span>}</p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <StageMenu oppId={opp.id} stage={opp.stage} outcome={opp.outcome} />
            <span className="chip">{confirmed ? TYPE_LABEL[opp.type] ?? opp.type : <Inferred>{TYPE_LABEL[opp.type] ?? opp.type}</Inferred>}</span>
            {opp.location && <span className="chip">{opp.location}</span>}
            {opp.applied_at && <span className="chip tabular">Applied {fmt(opp.applied_at)}</span>}
            {opp.archived === 1 && <span className="chip">Archived</span>}
          </div>
          {stageEvent && (
            <p className="mt-2 text-[12px] text-muted">
              {opp.manual_stage ? "Stage set by you" : <>Detected from email · <time>{fmtShort(stageEvent.at)}</time></>}
              {stageLink && <> · <a className="hover:text-accent" href={stageLink} target="_blank" rel="noreferrer">Open in Gmail</a></>}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {!confirmed && <ConfirmButton id={opp.id} />}
          <EditOppButton opp={opp} />
        </div>
      </div>

      {opp.stage !== "closed" && opp.stage !== "interested" && (
        <ol className="grid grid-cols-4 gap-1.5" aria-label="Progress">
          {["Applied", "Assessment", "Interview", "Offer"].map((s, i) => (
            <li key={s} className="text-[12px] font-medium" aria-current={i === stageIdx ? "step" : undefined}>
              <div className={`h-1 rounded-full ${i <= stageIdx ? "bg-accent" : "bg-line"}`} />
              <span className={`mt-1.5 block ${i <= stageIdx ? "text-ink" : "text-muted"}`}>{s}</span>
            </li>
          ))}
        </ol>
      )}

      {opp.stage === "closed" && opp.outcome === "rejected" && <AfterClosing org={opp.org} role={opp.role} contact={contact} sender={user.name} />}

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <section className="min-w-0" aria-label="Timeline">
          <h2 className="h-section border-b border-line pb-2">Timeline</h2>
          <div className="mt-3"><NoteForm oppId={opp.id} /></div>
          {events.length ? (
            <ol className="relative mt-5 space-y-5 border-l border-line pl-5">
              {events.map((e) => {
                const k = KIND[e.kind] ?? KIND.update;
                const link = e.source === "gmail" ? gmailLink(e.thread_id, e.ext_id) : null;
                return (
                  <li key={e.id} className="relative">
                    <span className="absolute -left-[25px] top-1.5 size-2.5 rounded-full ring-4 ring-[var(--bg)]" style={{ background: `var(--st-${k.tone}-fg)` }} />
                    <p className="text-[12px] text-muted"><time className="tabular">{fmt(e.at)}</time> · {k.label}</p>
                    <p className="mt-0.5 text-[14px] font-medium leading-5">{e.kind === "note" ? e.summary : e.msg_subject ?? e.summary}</p>
                    {e.evidence && (
                      <blockquote className="mt-1.5 border-l-2 border-line-strong pl-3 text-[14px] leading-5 text-ink-2">“{e.evidence}”</blockquote>
                    )}
                    {!e.evidence && e.kind !== "note" && e.summary && e.msg_subject && e.summary !== e.msg_subject && <p className="text-[13px] text-ink-2">{e.summary}</p>}
                    {(e.from_name || e.from_addr) && e.kind !== "note" && (
                      <p className="mt-1 flex flex-wrap items-center gap-1 text-[12px] text-muted">
                        {e.direction === "out" ? <SendIcon size={12} /> : <MailIcon size={12} />}
                        {e.direction === "out" ? "You" : e.from_name ?? e.from_addr}
                        {link && <> · <a className="inline-flex items-center gap-0.5 hover:text-accent" href={link} target="_blank" rel="noreferrer">Open in Gmail <ExternalIcon size={11} /></a></>}
                      </p>
                    )}
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="mt-4 text-[14px] text-muted">No emails linked yet.</p>
          )}
        </section>

        <aside className="min-w-0 space-y-6">
          {nextTask && (
            <section className="rounded-lg border border-line bg-surface px-4 py-3">
              <p className="eyebrow">Next action</p>
              <p className="mt-0.5 text-[14px] font-medium">{nextTask.title}</p>
              {nextTask.due_at && <p className="tabular text-[12px] text-muted">Due {fmt(nextTask.due_at + "T12:00:00Z")}</p>}
            </section>
          )}

          <section aria-label="Tasks">
            <h2 className="h-section border-b border-line pb-2">Tasks</h2>
            {tasks.length > 0 && <ul className="mt-1">{tasks.map((t) => <TaskItem key={t.id} task={t} today={today} keyed={false} />)}</ul>}
            <div className="mt-3"><AddTaskForm oppId={opp.id} /></div>
          </section>

          <section aria-label="People">
            <div className="flex items-center justify-between border-b border-line pb-2">
              <h2 className="h-section">Recommenders & reviewers</h2>
              {people.length > 0 && <AskButton people={people} opps={[{ id: opp.id, org: opp.org, role: opp.role }]} oppId={opp.id} label="Add" variant="ghost" />}
            </div>
            {asks.length ? (
              <ul className="mt-2 space-y-3">
                {asks.map((a) => (
                  <li key={a.id} className="text-[14px]">
                    <div className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate"><span className="font-medium">{a.person_name}</span> <span className="text-muted">· {a.kind}{a.due_at ? ` · due ${a.due_at}` : ""}</span></span>
                      <span className="flex shrink-0 items-center gap-1">
                        {a.status !== "submitted" && a.status !== "declined" && (
                          <ActionButton action={setAskStatus.bind(null, a.id, a.status === "agreed" ? "submitted" : "agreed")} className="btn btn-ghost btn-sm">
                            Mark {a.status === "agreed" ? "submitted" : "accepted"}
                          </ActionButton>
                        )}
                        <span className="chip">{ASK_WORD[a.status]}</span>
                      </span>
                    </div>
                    {(a.status === "asked" || a.status === "agreed") && a.kind === "recommendation" && (
                      <NudgeDraft name={a.person_name} email={a.person_email} org={opp.org} due={a.due_at} sender={user.name} />
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-[14px] text-muted">{people.length ? "No one tracked for this yet." : <>Add people on the <Link className="underline" href="/app/people">People</Link> page first.</>}</p>
            )}
          </section>

          <section className="space-y-3 text-[14px]" aria-label="Details">
            <h2 className="h-section border-b border-line pb-2">Details</h2>
            {opp.url && <p><a className="inline-flex items-center gap-1 font-medium text-accent" href={opp.url} target="_blank" rel="noreferrer">Posting / portal <ExternalIcon size={13} /></a></p>}
            {opp.notes ? <p className="whitespace-pre-wrap text-ink-2">{opp.notes}</p> : <p className="text-muted">No notes.</p>}
            <p className="text-[12px] text-muted">Reusable answers live in <Link className="underline" href="/app/answers">Answers</Link>.</p>
            <div className="border-t border-line pt-3"><OppActions id={opp.id} org={opp.org} archived={opp.archived === 1} /></div>
          </section>
        </aside>
      </div>
    </div>
  );
}
