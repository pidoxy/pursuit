import { DoorIcon, EyeIcon, LockIcon } from "./icons";

/** The three trust blocks, used on the pre-OAuth screen, the landing page and Settings. */
export const TRUST = {
  reads: "Emails that look like applications, recruiter messages, portal updates and recommendation notices: sender, subject, date and body. Everything else is skipped.",
  never: "Pursuit asks Google for read-only access. It can't send, delete, label or change anything in your inbox. We don't sell your data or use your email to train AI models.",
  leave: "Disconnect any time. Disconnecting revokes Google access and deletes everything Pursuit derived from your email: applications, deadlines, drafts and classifications.",
  limitedUse:
    "Pursuit's use and transfer to any other app of information received from Google APIs will adhere to Google API Services User Data Policy, including the Limited Use requirements.",
  expectations: "Pursuit gets most application emails right, but not all. Anything it's unsure about goes to Review for you to check.",
  alternative: "Prefer not to connect your inbox? Forward application emails to your private Pursuit address and we'll email you each time one is added.",
};

export function TrustBlocks({ compact = false }: { compact?: boolean }) {
  const items = [
    { icon: EyeIcon, title: "What Pursuit reads", body: TRUST.reads },
    { icon: LockIcon, title: "What Pursuit never does", body: TRUST.never },
    { icon: DoorIcon, title: "How to leave", body: TRUST.leave },
  ];
  return (
    <div className={`grid gap-4 ${compact ? "" : "md:grid-cols-3"}`}>
      {items.map((i) => (
        <div key={i.title} className={compact ? "flex gap-3" : "card p-5"}>
          <i.icon size={compact ? 18 : 20} className="mt-0.5 shrink-0 text-accent" />
          <div className={compact ? "" : "mt-3"}>
            <p className="text-[14px] font-medium">{i.title}</p>
            <p className="mt-1 text-[14px] leading-5 text-muted">{i.body}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export function LimitedUse() {
  return (
    <p className="text-[12px] leading-4 text-muted">
      {TRUST.limitedUse} <a href="/privacy" className="underline hover:text-ink">Privacy policy</a>
    </p>
  );
}
