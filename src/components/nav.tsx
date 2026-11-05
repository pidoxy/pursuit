"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useShell } from "./app-shell";
import { BookIcon, ChartIcon, HomeIcon, InboxIcon, KanbanIcon, SearchIcon, SettingsIcon, UsersIcon } from "./icons";

const NAV = [
  { href: "/app", label: "Today", icon: HomeIcon, keys: "G T" },
  { href: "/app/pipeline", label: "Pipeline", icon: KanbanIcon, keys: "G P" },
  { href: "/app/review", label: "Review", icon: InboxIcon, badge: true, keys: "G R" },
  { href: "/app/people", label: "People", icon: UsersIcon, keys: "G O" },
  { href: "/app/answers", label: "Answers", icon: BookIcon, keys: "G A" },
  { href: "/app/insights", label: "Insights", icon: ChartIcon, keys: "G I" },
  { href: "/app/settings", label: "Settings", icon: SettingsIcon, keys: "G S" },
];

const active = (path: string, href: string) => (href === "/app" ? path === "/app" || path === "/app/connect" : path.startsWith(href) || (href === "/app/pipeline" && path.startsWith("/app/o/")));

/** A dot, not a count: review items are a gentle nudge, not a debt. */
function Dot() {
  return <span className="size-2 rounded-full bg-accent" aria-label="Items waiting" />;
}

export function SearchButton({ compact = false }: { compact?: boolean }) {
  const shell = useShell();
  if (compact)
    return (
      <button type="button" className="btn btn-ghost btn-sm px-1.5" aria-label="Search and commands" onClick={() => shell?.openPalette("commands")}>
        <SearchIcon size={18} />
      </button>
    );
  return (
    <button
      type="button"
      onClick={() => shell?.openPalette("commands")}
      className="mt-4 flex h-8 w-full items-center gap-2 rounded-md border border-line bg-surface px-2.5 text-[13px] text-muted transition-colors hover:border-line-strong"
    >
      <SearchIcon size={15} />
      <span className="flex-1 text-left">Search or jump to…</span>
      <span className="kbd">⌘K</span>
    </button>
  );
}

export function SideNav({ reviewWaiting }: { reviewWaiting: boolean }) {
  const path = usePathname();
  return (
    <nav className="mt-3 space-y-px" aria-label="Main">
      {NAV.map((n) => {
        const on = active(path, n.href);
        return (
          <Link
            key={n.href}
            href={n.href}
            aria-current={on ? "page" : undefined}
            title={`${n.label} (${n.keys})`}
            className={`group flex h-8 items-center gap-2.5 rounded-md px-2.5 text-[13px] font-medium transition-colors ${
              on ? "bg-hover text-ink" : "text-muted hover:bg-hover hover:text-ink"
            }`}
          >
            <n.icon size={16} className={on ? "text-accent" : ""} />
            <span className="flex-1">{n.label}</span>
            {n.badge && reviewWaiting && <Dot />}
          </Link>
        );
      })}
    </nav>
  );
}

export function TabBar({ reviewWaiting }: { reviewWaiting: boolean }) {
  const path = usePathname();
  const items = [NAV[0], NAV[1], NAV[2], NAV[3], NAV[5]];
  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
      <div className="mx-auto grid max-w-md grid-cols-5">
        {items.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            aria-current={active(path, n.href) ? "page" : undefined}
            className={`relative flex min-h-12 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium ${active(path, n.href) ? "text-accent" : "text-muted"}`}
          >
            <n.icon size={20} />
            {n.label}
            {n.badge && reviewWaiting && <span className="absolute right-[28%] top-2"><Dot /></span>}
          </Link>
        ))}
      </div>
    </nav>
  );
}
