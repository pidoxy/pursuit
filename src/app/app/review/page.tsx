import { requireUser } from "@/lib/auth";
import { listOpportunities, reviewQueue } from "@/lib/data";
import { gmailLink } from "@/lib/urls";
import { ActionButton } from "@/components/action-button";
import { ReviewQueue, type ReviewEntry } from "@/components/review-queue";
import { reprocessAll } from "../actions";

export const metadata = { title: "Review" };

export default async function ReviewPage() {
  const user = await requireUser();
  const msgs = reviewQueue(user.id);
  const opps = listOpportunities(user.id).map((o) => ({ id: o.id, org: o.org, role: o.role }));
  const items: ReviewEntry[] = msgs.map((m) => ({
    id: m.id,
    subject: m.subject,
    from_name: m.from_name,
    from_addr: m.from_addr,
    date: m.date,
    body: (m.body || m.snippet || "").slice(0, 2000),
    link: m.source === "gmail" ? gmailLink(m.thread_id, m.ext_id) : null,
    guess: m.classification ? JSON.parse(m.classification) : null,
    suggested: m.opportunity_id && m.opp_org ? { id: m.opportunity_id, org: m.opp_org, role: m.opp_role, stage: m.opp_stage ?? "applied" } : null,
  }));
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="h-page">Review</h1>
          <p className="mt-1 max-w-xl text-[14px] text-muted">
            Emails Pursuit wasn&apos;t sure about, and any closings, wait here for you. Nothing is dropped or closed without you.
          </p>
        </div>
        {msgs.length > 0 && <ActionButton action={reprocessAll} pendingText="Re-checking…">Re-check all</ActionButton>}
      </div>
      <ReviewQueue items={items} opps={opps} />
    </div>
  );
}
