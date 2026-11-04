import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { OrgAvatar, StageBadge } from "@/components/badges";
import { BookIcon, CheckIcon, KanbanIcon, MailIcon, SendIcon, UsersIcon, Wordmark } from "@/components/icons";

export const dynamic = "force-dynamic";

function Preview() {
  const cols = [
    { stage: "applied", items: [["Northwind", "ML Engineer"], ["Lumen Fellowship", "2027 cohort"]] },
    { stage: "assessment", items: [["Acme Bank", "Summer Analyst"]] },
    { stage: "interview", items: [["Orbital AI", "Research Resident"]] },
  ];
  return (
    <div className="relative">
      <div className="pointer-events-none absolute -inset-6 -z-10 rounded-[2rem] bg-[radial-gradient(ellipse_at_top,var(--accent-soft),transparent_70%)]" />
      <div className="card overflow-hidden shadow-lg">
        <div className="border-b border-line bg-surface-2 px-5 py-3">
          <p className="text-xs font-semibold text-muted">TODAY</p>
          <p className="font-bold">2 things due, 1 follow-up owed</p>
        </div>
        <ul className="divide-y divide-line px-5">
          <li className="flex items-center gap-3 py-3">
            <span className="grid size-5 place-items-center rounded-md border-2 border-line-strong" />
            <span className="flex-1 text-sm font-medium">Complete the Lumen video interview</span>
            <span className="chip border-transparent bg-danger-soft text-danger">Due Tue</span>
          </li>
          <li className="flex items-center gap-3 py-3">
            <span className="grid size-5 place-items-center rounded-md border-2 border-line-strong" />
            <span className="flex-1 text-sm font-medium">Complete Acme Bank assessment</span>
            <span className="chip">Fri</span>
          </li>
          <li className="flex items-center gap-3 py-3">
            <span className="grid size-8 place-items-center rounded-lg bg-honey-soft text-xs font-bold text-honey">16d</span>
            <span className="flex-1 text-sm"><strong>Northwind</strong> <span className="text-muted">hasn&apos;t replied to your follow-up</span></span>
            <span className="btn btn-primary btn-sm">Draft</span>
          </li>
        </ul>
        <div className="grid grid-cols-3 gap-2 border-t border-line bg-sunken/60 p-3">
          {cols.map((c) => (
            <div key={c.stage} className="space-y-2">
              <StageBadge stage={c.stage} />
              {c.items.map(([org, role]) => (
                <div key={org} className="flex items-center gap-2 rounded-lg border border-line bg-surface p-2">
                  <OrgAvatar org={org} size={24} />
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold">{org}</p>
                    <p className="truncate text-[11px] text-muted">{role}</p>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const FEATURES = [
  { icon: MailIcon, title: "Builds itself from Gmail", body: "Read-only. Greenhouse, Lever, Workday, HackerRank, university portals — every confirmation, invite and rejection becomes a tracked opportunity." },
  { icon: CheckIcon, title: "Deadlines pulled from the email", body: "“Complete the assessment within 5 days” becomes a dated task. Nothing sits unread while the clock runs." },
  { icon: SendIcon, title: "Follow-ups you owe", body: "Threads where you wrote last and nobody answered — with a polite draft ready to open in Gmail." },
  { icon: UsersIcon, title: "Recommenders & reviewers", body: "Ask a lecturer for a letter and Pursuit tracks it: asked → agreed → submitted, per application." },
  { icon: BookIcon, title: "Answer bank", body: "Your bio, research pitch and ‘why us’ paragraphs, ready to copy instead of rewritten for the fifth time." },
  { icon: KanbanIcon, title: "Insights", body: "Response rates by type, where you stall, and how long companies actually take to reply." },
];

export default async function Landing() {
  const user = await currentUser();
  if (user) redirect("/app");
  return (
    <div className="overflow-x-hidden">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <Wordmark />
        <nav className="flex items-center gap-2">
          <Link href="/login" className="btn btn-ghost">Sign in</Link>
          <Link href="/signup" className="btn btn-primary">Get started</Link>
        </nav>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-20 pt-8 sm:px-6 lg:grid-cols-[1fr_1.05fr] lg:pt-16">
          <div>
            <span className="chip border-transparent bg-accent-soft text-accent">For jobs, internships, fellowships & grad school</span>
            <h1 className="h-display mt-5 text-[2.5rem] leading-[1.05] sm:text-[3.4rem]">
              Every application, deadline and follow-up — <span className="text-accent">tracked for you.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-2">
              Pursuit reads your application email and keeps your whole pipeline in one place. It tells you what&apos;s due,
              who still owes you an answer, and which recommender hasn&apos;t submitted yet — so nothing slips in a 16,000-unread inbox.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/signup" className="btn btn-primary h-12 px-6 text-base">Start free</Link>
              <a href="#features" className="btn btn-secondary h-12 px-6 text-base">How it works</a>
            </div>
            <p className="mt-4 text-sm text-muted">Gmail read-only · never sends email · export or delete everything anytime</p>
          </div>
          <Preview />
        </section>

        <section id="features" className="border-y border-line bg-surface-2">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <p className="eyebrow">What it does</p>
            <h2 className="h-display mt-2 text-3xl sm:text-4xl">Your inbox already knows. Pursuit makes it act.</h2>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((f) => (
                <div key={f.title} className="card p-6">
                  <span className="grid size-10 place-items-center rounded-lg bg-accent-soft text-accent"><f.icon /></span>
                  <h3 className="mt-4 font-semibold">{f.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-2">{f.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-20 text-center sm:px-6">
          <h2 className="h-display text-3xl sm:text-4xl">Applying to fifty places is a job. Let it feel like one.</h2>
          <p className="mx-auto mt-3 max-w-xl text-ink-2">Connect Gmail and see your last six months of applications organised in about a minute.</p>
          <Link href="/signup" className="btn btn-primary mt-7 h-12 px-6 text-base">Build my pipeline</Link>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-8 text-sm text-muted sm:flex-row sm:px-6">
          <Wordmark />
          <p>Built for people who apply to everything.</p>
        </div>
      </footer>
    </div>
  );
}
