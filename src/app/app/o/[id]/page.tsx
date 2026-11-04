import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { AskButton, EditOppButton } from "@/components/dialogs";
import { getOpportunity } from "@/lib/data";
import { db } from "@/lib/db";
import { gmailLink } from "@/lib/urls";
import { zonedDate } from "@/lib/time";
import { ActionButton } from "@/components/action-button";
import { OrgAvatar, STAGE_STYLE, StageBadge, TypeChip } from "@/components/badges";
import { AddTaskForm, NoteForm } from "@/components/forms";
import { ChevronLeft, ExternalIcon, MailIcon, SendIcon } from "@/components/icons";
import { StageSelect } from "@/components/stage-select";
import { TaskItem } from "@/components/task-item";
import { archiveOpportunity, deleteOpportunity, setAskStatus } from "../../actions";

export const metadata = { title: "Opportunity" };

const KIND: Record<string, { label: string; color: string }> = {
  received: { label: "Application received", color: STAGE_STYLE.applied.color },
  assessment: { label: "Assessment", color: STAGE_STYLE.assessment.color },
  assessment_done: { label: "Assessment submitted", color: STAGE_STYLE.assessment.color },
  interview: { label: "Interview", color: STAGE_STYLE.interview.color },
  offer: { label: "Offer", color: STAGE_STYLE.offer.color },
  rejection: { label: "Not moving forward", color: "#c2412d" },
  info_request: { label: "Information requested", color: "#b7791f" },
  update: { label: "Update", color: "#6b7385" },
  outbound: { label: "You wrote", color: "#6b7385" },
  note: { label: "Note", color: "#6b7385" },
};

const fmt = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

export default async function OpportunityPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const data = getOpportunity(user.id, (await params).id);
  if (!data) notFound();
  const { opp, events, tasks, asks } = data;
  const people = db.prepare(`SELECT id, name FROM people WHERE user_id = ? ORDER BY name`).all(user.id) as { id: string; name: string }[];
  const today = zonedDate(new Date(), user.timezone);
  const stageIdx = ["applied", "assessment", "interview", "offer"].indexOf(opp.stage);

  return (
    <div className="space-y-6">
      <Link href="/app/pipeline" className="inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-ink"><ChevronLeft size={16} /> Pipeline</Link>

      <div className="flex flex-wrap items-start gap-4">
        <OrgAvatar org={opp.org} size={52} />
        <div className="min-w-0 flex-1">
          <h1 className="h-display text-[1.9rem] leading-tight">{opp.org}</h1>
          <p className="text-ink-2">{opp.role ?? "Role not set"}</p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <StageBadge stage={opp.stage} outcome={opp.outcome} />
            <TypeChip type={opp.type} />
            {opp.location && <span className="chip">{opp.location}</span>}
            {opp.applied_at && <span className="chip">Applied {fmt(opp.applied_at)}</span>}
            {opp.archived === 1 && <span className="chip">Archived</span>}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StageSelect oppId={opp.id} stage={opp.stage} outcome={opp.outcome} />
          <EditOppButton opp={opp} />
        </div>
      </div>

      {opp.stage !== "closed" && opp.stage !== "interested" && (
        <ol className="grid grid-cols-4 gap-1.5" aria-label="Progress">
          {["Applied", "Assessment", "Interview", "Offer"].map((s, i) => (
            <li key={s} className="text-xs font-semibold">
              <div className={`h-1.5 rounded-full ${i <= stageIdx ? "bg-accent" : "bg-line"}`} />
              <span className={`mt-1.5 block ${i <= stageIdx ? "text-ink" : "text-muted"}`}>{s}</span>
            </li>
          ))}
        </ol>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section className="card min-w-0 p-5">
          <h2 className="font-semibold">Timeline</h2>
          <div className="mt-3"><NoteForm oppId={opp.id} /></div>
          {events.length ? (
            <ol className="relative mt-5 space-y-5 border-l border-line pl-5">
              {events.map((e) => {
                const k = KIND[e.kind] ?? KIND.update;
                const link = e.source === "gmail" ? gmailLink(e.thread_id, e.ext_id) : null;
                return (
                  <li key={e.id} className="relative">
                    <span className="absolute -left-[26px] top-1 size-3 rounded-full ring-4 ring-[var(--surface)]" style={{ background: k.color }} />
                    <p className="text-xs text-muted">{fmt(e.at)} · {k.label}</p>
                    <p className="mt-0.5 text-[0.93rem] font-medium leading-snug">{e.kind === "note" ? e.summary : e.msg_subject ?? e.summary}</p>
                    {e.kind !== "note" && e.summary && e.msg_subject && e.summary !== e.msg_subject && <p className="text-sm text-ink-2">{e.summary}</p>}
                    {(e.from_name || e.from_addr) && e.kind !== "note" && (
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-muted">
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
            <p className="mt-4 text-sm text-muted">No emails linked yet.</p>
          )}
        </section>

        <div className="min-w-0 space-y-6">
          <section className="card p-5">
            <h2 className="font-semibold">Tasks</h2>
            {tasks.length > 0 && <ul className="mt-1 divide-y divide-line">{tasks.map((t) => <TaskItem key={t.id} task={t} today={today} />)}</ul>}
            <div className="mt-3"><AddTaskForm oppId={opp.id} /></div>
          </section>

          <section className="card p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Recommenders & reviewers</h2>
              {people.length > 0 && (
                <AskButton people={people} opps={[{ id: opp.id, org: opp.org, role: opp.role }]} oppId={opp.id} label="Add" variant="ghost" />
              )}
            </div>
            {asks.length ? (
              <ul className="mt-3 space-y-2.5">
                {asks.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="min-w-0 truncate"><strong>{a.person_name}</strong> <span className="text-muted">· {a.kind}{a.due_at ? ` · due ${a.due_at}` : ""}</span></span>
                    <span className="flex shrink-0 gap-1">
                      {a.status !== "submitted" && (
                        <ActionButton action={setAskStatus.bind(null, a.id, a.status === "asked" ? "agreed" : "submitted")} className="btn btn-ghost btn-sm">
                          Mark {a.status === "asked" ? "agreed" : "submitted"}
                        </ActionButton>
                      )}
                      <span className="chip capitalize">{a.status.replace("_", " ")}</span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-muted">{people.length ? "No one tracked for this yet." : <>Add people on the <Link className="underline" href="/app/people">People</Link> page first.</>}</p>
            )}
          </section>

          <section className="card space-y-3 p-5 text-sm">
            <h2 className="font-semibold">Details</h2>
            {opp.url && <p><a className="inline-flex items-center gap-1 font-medium text-accent" href={opp.url} target="_blank" rel="noreferrer">Posting / portal <ExternalIcon size={13} /></a></p>}
            {opp.notes ? <p className="whitespace-pre-wrap text-ink-2">{opp.notes}</p> : <p className="text-muted">No notes.</p>}
            <div className="flex flex-wrap gap-2 border-t border-line pt-3">
              <ActionButton action={archiveOpportunity.bind(null, opp.id, opp.archived !== 1)} className="btn btn-ghost btn-sm">
                {opp.archived === 1 ? "Unarchive" : "Archive"}
              </ActionButton>
              <ActionButton action={deleteOpportunity.bind(null, opp.id)} className="btn btn-ghost btn-sm text-danger" confirmText={`Delete ${opp.org}? Linked emails will be ignored.`}>
                Delete
              </ActionButton>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
