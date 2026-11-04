"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookIcon, ChartIcon, HomeIcon, InboxIcon, KanbanIcon, SettingsIcon, UsersIcon } from "./icons";

const NAV = [
  { href: "/app", label: "Today", icon: HomeIcon },
  { href: "/app/pipeline", label: "Pipeline", icon: KanbanIcon },
  { href: "/app/review", label: "Review", icon: InboxIcon, badge: true },
  { href: "/app/people", label: "People", icon: UsersIcon },
  { href: "/app/answers", label: "Answers", icon: BookIcon },
  { href: "/app/insights", label: "Insights", icon: ChartIcon },
  { href: "/app/settings", label: "Settings", icon: SettingsIcon },
];

const active = (path: string, href: string) => (href === "/app" ? path === "/app" : path.startsWith(href) || (href === "/app/pipeline" && path.startsWith("/app/o/")));

export function SideNav({ reviewCount }: { reviewCount: number }) {
  const path = usePathname();
  return (
    <nav className="mt-6 space-y-0.5" aria-label="Main">
      {NAV.map((n) => {
        const on = active(path, n.href);
        return (
          <Link
            key={n.href}
            href={n.href}
            aria-current={on ? "page" : undefined}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-[0.92rem] font-medium transition-colors ${
              on ? "bg-surface text-ink shadow-sm ring-1 ring-line" : "text-ink-2 hover:bg-sunken hover:text-ink"
            }`}
          >
            <n.icon size={19} className={on ? "text-accent" : ""} />
            <span className="flex-1">{n.label}</span>
            {n.badge && reviewCount > 0 && (
              <span className="grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1.5 text-[11px] font-bold text-accent-ink">{reviewCount}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

export function TabBar({ reviewCount }: { reviewCount: number }) {
  const path = usePathname();
  const items = [NAV[0], NAV[1], NAV[2], NAV[3], NAV[6]];
  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
      <div className="mx-auto grid max-w-md grid-cols-5">
        {items.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            aria-current={active(path, n.href) ? "page" : undefined}
            className={`relative flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold ${active(path, n.href) ? "text-accent" : "text-muted"}`}
          >
            <n.icon size={21} />
            {n.label}
            {n.badge && reviewCount > 0 && (
              <span className="absolute right-[20%] top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-ink">{reviewCount}</span>
            )}
          </Link>
        ))}
      </div>
    </nav>
  );
}
