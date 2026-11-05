import Link from "next/link";
import { Wordmark } from "@/components/icons";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4 sm:px-6">
        <Link href="/" aria-label="Pursuit home"><Wordmark /></Link>
        <nav className="flex gap-1 text-[13px]">
          <Link href="/privacy" className="btn btn-ghost btn-sm">Privacy</Link>
          <Link href="/terms" className="btn btn-ghost btn-sm">Terms</Link>
        </nav>
      </header>
      <main className="mx-auto max-w-3xl px-4 pb-24 pt-8 sm:px-6">
        <article className="legal space-y-4 text-[15px] leading-6 text-ink-2">{children}</article>
      </main>
    </div>
  );
}
