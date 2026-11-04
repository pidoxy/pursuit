import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };

function base({ size = 20, ...rest }: P) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    ...rest,
  };
}

export const HomeIcon = (p: P) => (
  <svg {...base(p)}><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V20h14V9.5" /><path d="M10 20v-5h4v5" /></svg>
);
export const InboxIcon = (p: P) => (
  <svg {...base(p)}><path d="M3 13h5l1.5 3h5L16 13h5" /><path d="M5.5 5h13L21 13v6H3v-6z" /></svg>
);
export const CalendarIcon = (p: P) => (
  <svg {...base(p)}><rect x="3" y="4.5" width="18" height="16.5" rx="2.5" /><path d="M3 9.5h18M8 3v3M16 3v3" /></svg>
);
export const CheckSquareIcon = (p: P) => (
  <svg {...base(p)}><rect x="3.5" y="3.5" width="17" height="17" rx="3" /><path d="m8 12 3 3 5-6" /></svg>
);
export const SettingsIcon = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
  </svg>
);
export const CameraIcon = (p: P) => (
  <svg {...base(p)}><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>
);
export const UploadIcon = (p: P) => (
  <svg {...base(p)}><path d="M12 15V4M7.5 8.5 12 4l4.5 4.5" /><path d="M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4" /></svg>
);
export const MailIcon = (p: P) => (
  <svg {...base(p)}><rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="m4 7 8 6 8-6" /></svg>
);
export const TextIcon = (p: P) => (
  <svg {...base(p)}><path d="M5 6h14M5 10.5h14M5 15h9M5 19.5h6" /></svg>
);
export const CheckIcon = (p: P) => <svg {...base(p)}><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>;
export const XIcon = (p: P) => <svg {...base(p)}><path d="M6 6l12 12M18 6 6 18" /></svg>;
export const PencilIcon = (p: P) => (
  <svg {...base(p)}><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z" /><path d="m13.5 6.5 4 4" /></svg>
);
export const ClockIcon = (p: P) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></svg>
);
export const PinIcon = (p: P) => (
  <svg {...base(p)}><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0C18.5 15.4 12 21 12 21z" /><circle cx="12" cy="10" r="2.3" /></svg>
);
export const SparkIcon = (p: P) => (
  <svg {...base(p)}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6" /></svg>
);
export const BagIcon = (p: P) => (
  <svg {...base(p)}><path d="M5 8h14l-1 12H6z" /><path d="M9 8V6.5a3 3 0 0 1 6 0V8" /></svg>
);
export const ChevronLeft = (p: P) => <svg {...base(p)}><path d="m15 5-7 7 7 7" /></svg>;
export const ChevronRight = (p: P) => <svg {...base(p)}><path d="m9 5 7 7-7 7" /></svg>;
export const PlusIcon = (p: P) => <svg {...base(p)}><path d="M12 5v14M5 12h14" /></svg>;
export const CopyIcon = (p: P) => (
  <svg {...base(p)}><rect x="8.5" y="8.5" width="11.5" height="11.5" rx="2.5" /><path d="M15.5 8.5V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7.5a2 2 0 0 0 2 2h2.5" /></svg>
);
export const QuoteIcon = (p: P) => (
  <svg {...base(p)}><path d="M9 7H5v5h4v-1c0 2-1 4-4 5M19 7h-4v5h4v-1c0 2-1 4-4 5" /></svg>
);
export const FileIcon = (p: P) => (
  <svg {...base(p)}><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v4h4" /></svg>
);
export const LogoutIcon = (p: P) => (
  <svg {...base(p)}><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l-4-4 4-4M6 12h10" /></svg>
);
export const AlertIcon = (p: P) => (
  <svg {...base(p)}><path d="M12 4 2.5 20h19z" /><path d="M12 10v4.5M12 17.5v.01" /></svg>
);

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="8" fill="var(--accent)" />
      <path d="M9 22.5 15 16.5l3.5 3.5L24 13" fill="none" stroke="var(--accent-ink)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M19.5 12.5H24.5V17.5" fill="none" stroke="var(--accent-ink)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="inline-flex items-center gap-2">
      <Logo />
      <span className="h-display text-[1.25rem] leading-none">Pursuit</span>
    </span>
  );
}

export const KanbanIcon = (p: P) => (
  <svg {...base(p)}><rect x="3" y="4" width="5" height="14" rx="1.5" /><rect x="9.5" y="4" width="5" height="9" rx="1.5" /><rect x="16" y="4" width="5" height="11" rx="1.5" /></svg>
);
export const UsersIcon = (p: P) => (
  <svg {...base(p)}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.6-3.5 3.3-5.5 6.5-5.5s5.9 2 6.5 5.5" /><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.7c1.9.7 3.2 2.5 3.5 5.3" /></svg>
);
export const ChartIcon = (p: P) => (
  <svg {...base(p)}><path d="M4 20V4M4 20h16" /><path d="M8 16v-5M12 16V8M16 16v-3" /></svg>
);
export const BookIcon = (p: P) => (
  <svg {...base(p)}><path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z" /><path d="M5 17a3 3 0 0 1 3-3h11" /></svg>
);
export const ExternalIcon = (p: P) => (
  <svg {...base(p)}><path d="M14 4h6v6M20 4l-9 9" /><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></svg>
);
export const RefreshIcon = (p: P) => (
  <svg {...base(p)}><path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7" /></svg>
);
export const SendIcon = (p: P) => (
  <svg {...base(p)}><path d="M21 3 10 14M21 3l-7 18-4-7-7-4z" /></svg>
);
export const FlagIcon = (p: P) => (
  <svg {...base(p)}><path d="M5 21V4M5 4h11l-2 4 2 4H5" /></svg>
);
