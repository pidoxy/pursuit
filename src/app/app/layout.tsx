import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { LogoutIcon, SettingsIcon, Wordmark } from "@/components/icons";
import { SideNav, TabBar } from "@/components/nav";
import { logout } from "./actions";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const { n: reviewCount } = db.prepare(`SELECT COUNT(*) AS n FROM messages WHERE user_id = ? AND status = 'review'`).get(user.id) as { n: number };
  const gmail = db.prepare(`SELECT email FROM google_accounts WHERE user_id = ?`).get(user.id) as { email: string } | undefined;
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[240px_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-line bg-bg px-3 py-5 lg:flex">
        <Link href="/app" className="px-3"><Wordmark /></Link>
        <SideNav reviewCount={reviewCount} />
        <div className="mt-auto rounded-xl border border-line bg-surface p-3">
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{user.name}</p>
              <p className="truncate text-xs text-muted">{gmail ? `Gmail · ${gmail.email}` : "Gmail not connected"}</p>
            </div>
            <form action={logout}>
              <button className="btn btn-ghost btn-sm px-2" aria-label="Sign out" title="Sign out"><LogoutIcon size={17} /></button>
            </form>
          </div>
        </div>
      </aside>
      <div className="min-w-0">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-line bg-bg/90 px-4 py-3 backdrop-blur lg:hidden">
          <Link href="/app"><Wordmark /></Link>
          <Link href="/app/settings" className="btn btn-ghost btn-sm px-2" aria-label="Settings"><SettingsIcon /></Link>
        </header>
        <main className="mx-auto w-full max-w-6xl px-4 pb-32 pt-6 sm:px-6 lg:px-10 lg:pb-16 lg:pt-9">{children}</main>
      </div>
      <TabBar reviewCount={reviewCount} />
    </div>
  );
}
