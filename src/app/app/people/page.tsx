import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { AskButton, PersonButton } from "@/components/dialogs";
import { listOpportunities, listPeople } from "@/lib/data";
import { ActionButton } from "@/components/action-button";
import { NudgeDraft, ThanksDraft } from "@/components/people-drafts";
import { deletePerson, setAskStatus } from "../actions";

export const metadata = { title: "People" };

/** Portal vocabulary: requested → accepted → submitted. */
const WORD: Record<string, string> = { to_ask: "to ask", asked: "requested", agreed: "accepted", submitted: "submitted", declined: "declined" };
const NEXT: Record<string, { status: string; label: string }> = {
  to_ask: { status: "asked", label: "Mark requested" },
  asked: { status: "agreed", label: "Mark accepted" },
  agreed: { status: "submitted", label: "Mark submitted" },
};
const TONE: Record<string, React.CSSProperties> = {
  asked: { background: "var(--st-assess-bg)", color: "var(--st-assess-fg)", borderColor: "transparent" },
  agreed: { background: "var(--st-applied-bg)", color: "var(--st-applied-fg)", borderColor: "transparent" },
  submitted: { background: "var(--st-offer-bg)", color: "var(--st-offer-fg)", borderColor: "transparent" },
};

function ago(iso: string | null) {
  if (!iso) return "no contact yet";
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400_000);
  return d <= 0 ? "in touch today" : d === 1 ? "in touch yesterday" : `last in touch ${d}d ago`;
}

export default async function PeoplePage() {
  const user = await requireUser();
  const people = listPeople(user.id);
  const opps = listOpportunities(user.id).map((o) => ({ id: o.id, org: o.org, role: o.role }));
  const simplePeople = people.map((p) => ({ id: p.id, name: p.name }));
  const owed = people.reduce((n, p) => n + p.owes, 0);
  const dueWeek = people.reduce((n, p) => n + p.dueThisWeek, 0);
  const weekAgo = new Date(Date.now() - 7 * 86400_000).toISOString();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="h-page">People</h1>
          <p className="mt-1 text-[14px] text-muted">
            Recommenders, reviewers and contacts across every application, most active first.
            {owed > 0 && <> <span className="tabular font-medium text-ink-2">{owed}</span> {owed === 1 ? "letter is" : "letters are"} still out{dueWeek ? `, ${dueWeek} due this week` : ""}.</>}
          </p>
        </div>
        <div className="flex gap-2">
          {people.length > 0 && <AskButton people={simplePeople} opps={opps} />}
          <PersonButton primary />
        </div>
      </div>

      {people.length ? (
        <ul className="divide-y divide-line border-y border-line">
          {people.map((p) => {
            const recs = p.asks.filter((a) => a.kind === "recommendation" && (a.status === "asked" || a.status === "agreed"));
            const justSubmitted = p.asks.filter((a) => a.status === "submitted" && (a.submitted_at ?? a.updated_at) >= weekAgo);
            return (
              <li key={p.id} data-nav-item="" tabIndex={-1} className="py-4 outline-none">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[14px] font-medium">{p.name}</p>
                    <p className="truncate text-[12px] text-muted">
                      {[p.relation, p.email].filter(Boolean).join(" · ") || "No email"} · {ago(p.lastContact)}
                    </p>
                    {p.owes > 0 && (
                      <p className="mt-1 text-[13px] text-ink-2">
                        Owes <span className="tabular font-medium">{p.owes}</span> {p.owes === 1 ? "letter" : "letters"}
                        {p.dueThisWeek > 0 && <>, <span className="tabular font-medium">{p.dueThisWeek}</span> due this week</>}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <PersonButton person={p} />
                    <ActionButton action={deletePerson.bind(null, p.id)} className="btn btn-ghost btn-sm" dataKey="del">Remove</ActionButton>
                  </div>
                </div>
                {p.asks.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {p.asks.map((a) => (
                      <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-surface-2 px-3 py-1.5 text-[13px]">
                        <span className="min-w-0">
                          <span className="font-medium capitalize">{a.kind}</span>
                          {a.org ? <> for <Link className="hover:text-accent" href={`/app/o/${a.opportunity_id}`}>{a.org}</Link></> : a.notes ? <span className="text-muted"> · {a.notes}</span> : null}
                          {a.due_at && <span className="tabular text-muted"> · due {a.due_at}</span>}
                        </span>
                        <span className="flex items-center gap-1">
                          {NEXT[a.status] && (
                            <ActionButton action={setAskStatus.bind(null, a.id, NEXT[a.status].status)} className="btn btn-ghost btn-sm">{NEXT[a.status].label}</ActionButton>
                          )}
                          <span className="chip" style={TONE[a.status]}>{WORD[a.status]}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-1.5 flex flex-wrap gap-x-5">
                  {recs[0] && <NudgeDraft name={p.name} email={p.email} org={recs[0].org} due={recs[0].due_at} sender={user.name} />}
                  {justSubmitted[0] && <ThanksDraft name={p.name} email={p.email} org={justSubmitted[0].org} sender={user.name} />}
                  <AskButton people={simplePeople} opps={opps} personId={p.id} label="Track an ask" variant="ghost" />
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="card px-6 py-12 text-center">
          <p className="h-section">No one yet</p>
          <p className="mt-1 text-[14px] text-muted">Emails you send asking for a recommendation or a draft review are tracked here automatically. You can also add people by hand.</p>
        </div>
      )}
    </div>
  );
}
