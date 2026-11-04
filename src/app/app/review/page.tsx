import { requireUser } from "@/lib/auth";
import { listOpportunities, reviewQueue } from "@/lib/data";
import { gmailLink } from "@/lib/urls";
import { ActionButton } from "@/components/action-button";
import { ReviewItem } from "@/components/review-item";
import { reprocessAll } from "../actions";

export const metadata = { title: "Review" };

export default async function ReviewPage() {
  const user = await requireUser();
  const msgs = reviewQueue(user.id);
  const opps = listOpportunities(user.id).map((o) => ({ id: o.id, org: o.org, role: o.role }));
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="h-display text-3xl">Review</h1>
          <p className="mt-1 max-w-xl text-ink-2">Emails that look application-related but Pursuit wasn&apos;t sure about. Track them, attach them, or dismiss them — nothing is dropped silently.</p>
        </div>
        {msgs.length > 0 && <ActionButton action={reprocessAll} pendingText="Re-checking…">Re-check all</ActionButton>}
      </div>
      {msgs.length ? (
        <ul className="space-y-3">
          {msgs.map((m) => {
            const c = m.classification ? JSON.parse(m.classification) : null;
            return <ReviewItem key={m.id} msg={m} guess={c} opps={opps} link={m.source === "gmail" ? gmailLink(m.thread_id, m.ext_id) : null} />;
          })}
        </ul>
      ) : (
        <div className="rounded-2xl border border-dashed border-line-strong p-10 text-center">
          <p className="font-semibold">All clear</p>
          <p className="mt-1 text-sm text-muted">Uncertain emails will wait here for you.</p>
        </div>
      )}
    </div>
  );
}
