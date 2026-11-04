export const STAGE_STYLE: Record<string, { label: string; color: string }> = {
  interested: { label: "Interested", color: "#6b7385" },
  applied: { label: "Applied", color: "#3f6fd8" },
  assessment: { label: "Assessment", color: "#b7791f" },
  interview: { label: "Interview", color: "#7c4fd6" },
  offer: { label: "Offer", color: "#1f8f4e" },
  closed: { label: "Closed", color: "#8a8f99" },
};

export const TYPE_LABEL: Record<string, string> = {
  job: "Job", internship: "Internship", fellowship: "Fellowship", grad_school: "Grad school",
  scholarship: "Scholarship", research: "Research", program: "Program",
};

const OUTCOME: Record<string, { label: string; color: string }> = {
  rejected: { label: "Rejected", color: "#c2412d" },
  withdrawn: { label: "Withdrawn", color: "#8a8f99" },
  declined: { label: "Declined", color: "#8a8f99" },
  accepted: { label: "Accepted", color: "#1f8f4e" },
};

function tint(color: string) {
  return {
    background: `color-mix(in srgb, ${color} 13%, transparent)`,
    color: `color-mix(in srgb, ${color} 78%, var(--ink))`,
    borderColor: "transparent",
  };
}

export function StageBadge({ stage, outcome }: { stage: string; outcome?: string | null }) {
  const s = stage === "closed" && outcome && OUTCOME[outcome] ? OUTCOME[outcome] : (STAGE_STYLE[stage] ?? STAGE_STYLE.applied);
  return (
    <span className="chip" style={tint(s.color)}>
      <span className="size-1.5 rounded-full" style={{ background: s.color }} />
      {s.label}
    </span>
  );
}

export function TypeChip({ type }: { type: string }) {
  return <span className="chip">{TYPE_LABEL[type] ?? type}</span>;
}

export function OrgAvatar({ org, size = 36 }: { org: string; size?: number }) {
  // Deterministic hue per org so the same company always looks the same.
  let h = 0;
  for (const ch of org) h = (h * 31 + ch.charCodeAt(0)) % 360;
  const letters = org.replace(/[^A-Za-z0-9 ]/g, "").split(/\s+/).filter(Boolean).map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "?";
  return (
    <span
      aria-hidden
      className="inline-grid shrink-0 place-items-center rounded-lg font-bold"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.36,
        background: `hsl(${h} 55% 92%)`,
        color: `hsl(${h} 45% 30%)`,
      }}
    >
      {letters}
    </span>
  );
}
