import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { OrgAvatar, StageBadge } from "@/components/badges";
import { MailIcon, Wordmark } from "@/components/icons";
import { LimitedUse, TrustBlocks } from "@/components/trust";

export const dynamic = "force-dynamic";

/** A fictional confirmation email becoming a pipeline card, on a loop. Static under reduced motion. */
function HeroLoop() {
  return (
    <div className="hero-loop relative mx-auto w-full max-w-md" aria-label="Illustration: an interview email becomes a pipeline card with a deadline" role="img">
      <div className="hero-email card p-4">
        <div className="flex items-center gap-2 text-[12px] text-muted">
          <MailIcon size={14} /> Orbital AI Recruiting · via Greenhouse
        </div>
        <p className="mt-2 text-[14px] font-medium">Orbital AI: interview invitation</p>
        <p className="mt-1 text-[14px] leading-5 text-ink-2">
          Thanks again for applying for the Research Resident position.{" "}
          <mark className="hero-mark rounded-[3px] px-0.5 text-ink">We&apos;d like to invite you to a technical interview. Please share your availability by Nov 20.</mark>
        </p>
      </div>
      <div className="hero-arrow my-3 flex justify-center text-muted" aria-hidden>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 5v14M6 13l6 6 6-6" /></svg>
      </div>
      <div className="hero-card card p-3">
        <div className="flex items-start gap-2.5">
          <OrgAvatar org="Orbital AI" size={28} />
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-medium">Orbital AI</p>
            <p className="text-[12px] text-muted">Research Resident</p>
          </div>
          <StageBadge stage="interview" />
        </div>
        <div className="mt-2.5 flex items-center justify-between border-t border-line pt-2 text-[12px]">
          <span className="text-ink-2">Share availability</span>
          <span className="tabular text-muted">Due Fri 20 Nov</span>
        </div>
      </div>
    </div>
  );
}

const STEPS = [
  { n: "1", title: "Connect", body: "Gmail read-only, a forwarding address, or a file. Pursuit reads the last six months." },
  { n: "2", title: "Detect", body: "Confirmations, assessments, interviews, offers and closings become applications with a stage and a timeline." },
  { n: "3", title: "Review", body: "Anything Pursuit isn't sure about waits for you, with the sentence it used. Press E to accept, Z to undo." },
  { n: "4", title: "Today", body: "A short list: what's due, follow-ups you could send, and who you're waiting on. Then you're done." },
];

const SEGMENTS = [
  ["Jobs", "Greenhouse, Lever, Workday, Ashby and direct recruiter mail"],
  ["Internships", "Seasonal cycles kept apart by year"],
  ["Fellowships", "Video interviews, essays and reviewers"],
  ["Grad school", "Portals, statements and recommenders"],
  ["Scholarships", "Deadlines pulled from the email itself"],
];

const FAQ: [string, React.ReactNode][] = [
  ["What if I don't want to connect Gmail?", "Forward application emails to your private Pursuit address, or import a file. Each forwarded email gets a short receipt so you know it was added."],
  ["Can Pursuit send email or change my inbox?", "No. It asks Google for read-only access. Follow-up drafts open in Gmail for you to edit and send yourself."],
  ["What happens to rejections?", "They're shown as Closed, in gray, and they wait in Review for you to confirm. Pursuit never sends a notification about a closing."],
  ["Will it notify me constantly?", "One digest a day by default, at the time you choose. Only interview invitations and deadlines under 48 hours reach you right away, and you can pause everything for a week."],
  ["How do I leave?", "Disconnect any time. That revokes Google access and deletes everything Pursuit derived from your email. You can also export everything as JSON first."],
];

export default async function Landing() {
  if (await currentUser()) redirect("/app");
  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Wordmark />
        <nav className="flex items-center gap-1">
          <a href="#privacy" className="btn btn-ghost btn-sm max-sm:hidden">Privacy</a>
          <Link href="/login" className="btn btn-ghost btn-sm">Sign in</Link>
          <Link href="/signup" className="btn btn-primary btn-sm">Get started</Link>
        </nav>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-20 pt-12 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:pt-20">
          <div>
            <h1 className="h-display text-[40px] leading-[1.05] tracking-[-0.03em] sm:text-[56px]">Every application, tracked from your inbox.</h1>
            <p className="mt-5 max-w-lg text-[16px] leading-6 text-ink-2">
              Pursuit reads your application email and keeps jobs, internships, fellowships, grad school and scholarships in one calm list: every stage, every deadline, and every follow-up you could send.
            </p>
            <div className="mt-8 flex flex-wrap gap-2">
              <Link href="/signup" className="btn btn-primary h-11 px-5 text-[15px]">Connect Gmail, read-only</Link>
              <Link href="/signup?next=%2Fapp%2Fconnect%3Fsample%3D1" className="btn btn-secondary h-11 px-5 text-[15px]">See it with sample data</Link>
            </div>
            <p className="mt-3 text-[13px] text-muted">Read-only. Pursuit can&apos;t send, delete or change your email.</p>
          </div>
          <HeroLoop />
        </section>

        <section className="border-t border-line bg-surface" aria-labelledby="how">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <h2 id="how" className="h-display text-[24px] leading-8">How it works</h2>
            <ol className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((s) => (
                <li key={s.n}>
                  <span className="tabular grid size-7 place-items-center rounded-full border border-line-strong text-[13px] font-medium">{s.n}</span>
                  <p className="mt-3 text-[16px] font-semibold">{s.title}</p>
                  <p className="mt-1 text-[14px] leading-5 text-muted">{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="privacy" className="scroll-mt-16" aria-labelledby="privacy-h">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <h2 id="privacy-h" className="h-display text-[24px] leading-8">Your inbox, on your terms</h2>
            <p className="mt-2 max-w-2xl text-[14px] text-muted">Pursuit asks for the narrowest Gmail access it can use, and tells you exactly what happens to your email.</p>
            <div className="mt-8"><TrustBlocks /></div>
            <div className="mt-6 max-w-3xl"><LimitedUse /></div>
          </div>
        </section>

        <section className="border-t border-line bg-surface" aria-labelledby="who">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <h2 id="who" className="h-display text-[24px] leading-8">One list for every kind of application</h2>
            <ul className="mt-8 grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-2 lg:grid-cols-5">
              {SEGMENTS.map(([t, d]) => (
                <li key={t} className="bg-surface p-4">
                  <p className="text-[14px] font-medium">{t}</p>
                  <p className="mt-1 text-[13px] leading-5 text-muted">{d}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section aria-labelledby="faq">
          <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
            <h2 id="faq" className="h-display text-[24px] leading-8">Questions</h2>
            <dl className="mt-6 divide-y divide-line border-y border-line">
              {FAQ.map(([q, a]) => (
                <details key={q} className="group py-4">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[15px] font-medium">
                    <dt>{q}</dt>
                    <span aria-hidden className="text-muted transition-transform group-open:rotate-45">+</span>
                  </summary>
                  <dd className="mt-2 text-[14px] leading-6 text-ink-2">{a}</dd>
                </details>
              ))}
            </dl>
            <div className="mt-10 flex flex-wrap gap-2">
              <Link href="/signup" className="btn btn-primary">Connect Gmail, read-only</Link>
              <Link href="/signup?next=%2Fapp%2Fconnect%3Fsample%3D1" className="btn btn-secondary">See it with sample data</Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-[12px] text-muted sm:px-6">
          <span>Pursuit · open source · self-hostable</span>
          <span className="max-w-xl">Pursuit&apos;s use of information received from Google APIs adheres to the Google API Services User Data Policy, including the Limited Use requirements.</span>
        </div>
      </footer>
    </div>
  );
}
