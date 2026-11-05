import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { reviewCount } from "@/lib/data";
import { isPaused } from "@/lib/brief";
import { AppShell, type PaletteOpp } from "@/components/app-shell";
import { LogoutIcon, SettingsIcon, Wordmark } from "@/components/icons";
import { SearchButton, SideNav, TabBar } from "@/components/nav";
import { logout } from "./actions";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const waiting = reviewCount(user.id) > 0;
  const gmail = db.prepare(`SELECT email FROM google_accounts WHERE user_id = ?`).get(user.id) as { email: string } | undefined;
  const opps = db
    .prepare(`SELECT id, org, role, stage FROM opportunities WHERE user_id = ? AND deleted_at IS NULL AND archived = 0 ORDER BY IFNULL(last_activity_at, created_at) DESC LIMIT 500`)
    .all(user.id) as PaletteOpp[];
  const paused = isPaused(user);
  return (
    <AppShell opps={opps}>
      <div className="min-h-dvh lg:grid lg:grid-cols-[240px_1fr]">
        <aside className="sticky top-0 hidden h-dvh flex-col border-r border-line bg-bg px-3 py-4 lg:flex">
          <Link href="/app" className="px-2.5 py-1"><Wordmark /></Link>
          <SearchButton />
          <SideNav reviewWaiting={waiting} />
          <div className="mt-auto space-y-2">
            {paused && (
              <Link href="/app/settings#notifications" className="block rounded-md px-2.5 py-2 text-[12px] text-muted hover:bg-hover">
                Notifications paused until {user.paused_until!.slice(0, 10)}
              </Link>
            )}
            <div className="flex items-center gap-2 rounded-md border border-line px-2.5 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium">{user.name}</p>
                <p className="truncate text-[12px] text-muted">{gmail ? `Gmail · ${gmail.email}` : "Gmail not connected"}</p>
              </div>
              <form action={logout}>
                <button className="btn btn-ghost btn-sm px-1.5" aria-label="Sign out" title="Sign out"><LogoutIcon size={16} /></button>
              </form>
            </div>
          </div>
        </aside>
        <div className="min-w-0">
          <header className="sticky top-0 z-20 flex h-12 items-center justify-between border-b border-line bg-bg/90 px-4 backdrop-blur lg:hidden">
            <Link href="/app"><Wordmark /></Link>
            <div className="flex items-center gap-1">
              <SearchButton compact />
              <Link href="/app/settings" className="btn btn-ghost btn-sm px-1.5" aria-label="Settings"><SettingsIcon size={18} /></Link>
            </div>
          </header>
          <main className="mx-auto w-full max-w-[1280px] px-4 pb-32 pt-6 sm:px-6 lg:px-10 lg:pb-16 lg:pt-8">{children}</main>
        </div>
        <TabBar reviewWaiting={waiting} />
      </div>
    </AppShell>
  );
}
