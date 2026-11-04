import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { AskButton, PersonButton } from "@/components/dialogs";
import { listOpportunities, listPeople } from "@/lib/data";
import { ActionButton } from "@/components/action-button";
import { deletePerson, setAskStatus } from "../actions";

export const metadata = { title: "People" };

const STATUS_FLOW: Record<string, string> = { to_ask: "asked", asked: "agreed", agreed: "submitted" };
const STATUS_TONE: Record<string, string> = {
  to_ask: "", asked: "bg-honey-soft text-honey border-transparent", agreed: "bg-accent-soft text-accent border-transparent",
  submitted: "bg-sage-soft text-sage border-transparent", declined: "bg-danger-soft text-danger border-transparent",
};

export default async function PeoplePage() {
  const user = await requireUser();
  const people = listPeople(user.id);
  const opps = listOpportunities(user.id).map((o) => ({ id: o.id, org: o.org, role: o.role }));
  const simplePeople = people.map((p) => ({ id: p.id, name: p.name }));
  const open = people.flatMap((p) => p.asks).filter((a) => ["to_ask", "asked", "agreed"].includes(a.status)).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="h-display text-3xl">People</h1>
          <p className="mt-1 text-ink-2">Recommenders, reviewers and referrers. {open ? `${open} ${open === 1 ? "ask is" : "asks are"} still open.` : ""}</p>
          <p className="mt-1 text-sm text-muted">Emails you send asking for a recommendation or a draft review are tracked here automatically.</p>
        </div>
        <div className="flex gap-2">
          {people.length > 0 && (
            <AskButton people={simplePeople} opps={opps} />
          )}
          <PersonButton primary />
        </div>
      </div>

      {people.length ? (
        <ul className="grid gap-4 md:grid-cols-2">
          {people.map((p) => (
            <li key={p.id} className="card p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold">{p.name}</p>
                  <p className="truncate text-sm text-muted">{[p.relation, p.email].filter(Boolean).join(" · ") || "—"}</p>
                </div>
                <div className="flex gap-1">
                  <PersonButton person={p} />
                  <ActionButton action={deletePerson.bind(null, p.id)} className="btn btn-ghost btn-sm text-danger" confirmText={`Remove ${p.name} and their asks?`}>Remove</ActionButton>
                </div>
              </div>
              {p.asks.length ? (
                <ul className="mt-3 space-y-2">
                  {p.asks.map((a) => (
                    <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface-2 px-3 py-2 text-sm">
                      <span className="min-w-0">
                        <span className="font-medium capitalize">{a.kind}</span>
                        {a.org ? <> for <Link className="hover:text-accent" href={`/app/o/${a.opportunity_id}`}>{a.org}</Link></> : a.notes ? <span className="text-muted"> · {a.notes}</span> : null}
                        {a.due_at && <span className="text-muted"> · due {a.due_at}</span>}
                      </span>
                      <span className="flex items-center gap-1">
                        {STATUS_FLOW[a.status] && (
                          <ActionButton action={setAskStatus.bind(null, a.id, STATUS_FLOW[a.status])} className="btn btn-ghost btn-sm">→ {STATUS_FLOW[a.status]}</ActionButton>
                        )}
                        <span className={`chip capitalize ${STATUS_TONE[a.status]}`}>{a.status.replace("_", " ")}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-muted">No asks yet.</p>
              )}
              <div className="mt-3">
                <AskButton people={simplePeople} opps={opps} personId={p.id} label="Track an ask" variant="ghost" />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-2xl border border-dashed border-line-strong p-10 text-center">
          <p className="font-semibold">No one yet</p>
          <p className="mt-1 text-sm text-muted">Add the lecturers, managers and friends who write letters or review your drafts.</p>
        </div>
      )}
    </div>
  );
}
