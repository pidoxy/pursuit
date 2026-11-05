/** Stage chips: step-3 background + step-11 text at one hue, always with a label and a glyph. Never the accent. */
export const STAGE_STYLE: Record<string, { label: string; tone: string }> = {
  interested: { label: "Interested", tone: "interested" },
  applied: { label: "Applied", tone: "applied" },
  assessment: { label: "Assessment", tone: "assess" },
  interview: { label: "Interview", tone: "interview" },
  offer: { label: "Offer", tone: "offer" },
  closed: { label: "Closed", tone: "closed" },
};

export const TYPE_LABEL: Record<string, string> = {
  job: "Job", internship: "Internship", fellowship: "Fellowship", grad_school: "Grad school",
  scholarship: "Scholarship", research: "Research", program: "Program",
};

/** Closings are neutral. "Rejected" never appears in a header. */
export const OUTCOME_LABEL: Record<string, string> = {
  rejected: "Closed",
  withdrawn: "Withdrawn",
  declined: "Declined",
  dormant: "Dormant",
  accepted: "Accepted",
};

function Glyph({ stage }: { stage: string }) {
  const p = { width: 11, height: 11, viewBox: "0 0 12 12", fill: "none", stroke: "currentColor", strokeWidth: 1.5, "aria-hidden": true } as const;
  switch (stage) {
    case "interested": return <svg {...p}><circle cx="6" cy="6" r="4" strokeDasharray="2 1.6" /></svg>;
    case "applied": return <svg {...p}><circle cx="6" cy="6" r="4" /></svg>;
    case "assessment": return <svg {...p}><circle cx="6" cy="6" r="4" /><path d="M6 2a4 4 0 0 1 0 8z" fill="currentColor" /></svg>;
    case "interview": return <svg {...p}><circle cx="6" cy="6" r="4" /><path d="M6 2a4 4 0 1 1-4 4h4z" fill="currentColor" /></svg>;
    case "offer": return <svg {...p}><circle cx="6" cy="6" r="4" fill="currentColor" /><path d="m4.2 6.1 1.3 1.3 2.4-2.6" stroke="var(--st-offer-bg)" /></svg>;
    default: return <svg {...p}><circle cx="6" cy="6" r="4" /><path d="M3.5 8.5l5-5" /></svg>;
  }
}

export function StageBadge({ stage, outcome }: { stage: string; outcome?: string | null }) {
  const s = STAGE_STYLE[stage] ?? STAGE_STYLE.applied;
  const accepted = stage === "closed" && outcome === "accepted";
  const tone = accepted ? "offer" : s.tone;
  const label = stage === "closed" && outcome && OUTCOME_LABEL[outcome] ? OUTCOME_LABEL[outcome] : s.label;
  return (
    <span className="chip border-transparent" style={{ background: `var(--st-${tone}-bg)`, color: `var(--st-${tone}-fg)` }}>
      <Glyph stage={accepted ? "offer" : stage} />
      {label}
    </span>
  );
}

export function TypeChip({ type }: { type: string }) {
  return <span className="chip">{TYPE_LABEL[type] ?? type}</span>;
}

export function OrgAvatar({ org, size = 32 }: { org: string; size?: number }) {
  // Deterministic hue per org so the same company always looks the same.
  let h = 0;
  for (const ch of org) h = (h * 31 + ch.charCodeAt(0)) % 360;
  const letters = org.replace(/[^\p{L}\p{N} ]/gu, "").split(/\s+/).filter(Boolean).map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "?";
  return (
    <span
      aria-hidden
      className="inline-grid shrink-0 place-items-center rounded-md font-semibold"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.36,
        background: `oklch(0.94 0.04 ${h})`,
        color: `oklch(0.4 0.08 ${h})`,
      }}
    >
      {letters}
    </span>
  );
}

/** Small mail glyph marking a field Pursuit inferred from email and you haven't confirmed. */
export function Inferred({ children, title = "Detected from email, not yet confirmed" }: { children: React.ReactNode; title?: string }) {
  return (
    <span className="inferred" title={title}>
      {children}
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-label="inferred from email" className="ml-1 inline-block align-[-1px]">
        <rect x="3" y="5.5" width="18" height="13" rx="2" /><path d="m4 7 8 6 8-6" />
      </svg>
    </span>
  );
}
