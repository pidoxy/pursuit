"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { finishOnboarding, scanCounts } from "@/app/app/actions";

type Counts = Awaited<ReturnType<typeof scanCounts>>;

/** Live counts while the backfill runs, instead of a spinner. Ends in the first triage. */
export function ScanProgress({ initial, scanning, months }: { initial: Counts; scanning: boolean; months: number }) {
  const [c, setC] = useState(initial);
  const [live, setLive] = useState(scanning);
  useEffect(() => {
    if (!live) return;
    const t = setInterval(async () => {
      const next = await scanCounts();
      setC(next);
      const r = await fetch("/api/sync/status").then((r) => r.json()).catch(() => null);
      if (r && r.done) setLive(false);
    }, 2000);
    return () => clearInterval(t);
  }, [live]);
  return (
    <div className="space-y-5">
      <div aria-live="polite">
        <p className="text-[14px] text-muted">{live ? `Scanning the last ${months} months…` : "Scan complete"}</p>
        <p className="tabular mt-1 text-[20px] font-semibold leading-7">
          {c.applications} application{c.applications === 1 ? "" : "s"}, {c.interviews} interview{c.interviews === 1 ? "" : "s"}, {c.deadlines} deadline{c.deadlines === 1 ? "" : "s"} this week
        </p>
        <p className="tabular mt-1 text-[13px] text-muted">{c.emails} emails read{live ? " so far" : ""}</p>
        {live && <div className="mt-3 h-1 overflow-hidden rounded-full bg-line"><div className="h-full w-1/3 animate-[slide_1.4s_var(--ease-out)_infinite] rounded-full bg-accent" /></div>}
      </div>
      <p className="text-[14px] text-ink-2">Pursuit gets most application emails right, but not all. Anything it&apos;s unsure about goes to Review for you to check.</p>
      <div className="flex flex-wrap gap-2">
        {c.review > 0 ? (
          <Link href="/app/review" onClick={() => void finishOnboarding()} className="btn btn-primary">Check {c.review} uncertain email{c.review === 1 ? "" : "s"}</Link>
        ) : null}
        <Link href="/app" onClick={() => void finishOnboarding()} className={c.review > 0 ? "btn btn-secondary" : "btn btn-primary"}>Go to Today</Link>
      </div>
      {c.review > 0 && (
        <p className="text-[12px] text-muted">
          In Review: <span className="kbd">E</span> accept · <span className="kbd">1</span> track as new · <span className="kbd">2</span> not an application · <span className="kbd">3</span> attach · <span className="kbd">H</span> snooze · <span className="kbd">Z</span> undo
        </p>
      )}
    </div>
  );
}
