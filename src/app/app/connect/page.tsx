import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { googleConfigured } from "@/lib/gmail";
import { inboundAddress } from "@/lib/urls";
import { ScanProgress } from "@/components/scan-progress";
import { SampleDataButton } from "@/components/sample-data";
import { LimitedUse, TRUST, TrustBlocks } from "@/components/trust";
import { CopyField, ImportForm } from "../settings/forms";
import { scanCounts } from "../actions";
import { MailIcon, SendIcon, UploadIcon } from "@/components/icons";

export const metadata = { title: "Get started" };

const STEPS = ["Choose", "Review access", "Scan", "Triage"];

function Steps({ at }: { at: number }) {
  return (
    <ol className="flex gap-4 text-[12px]" aria-label="Setup steps">
      {STEPS.map((s, i) => (
        <li key={s} aria-current={i === at ? "step" : undefined} className={`flex items-center gap-1.5 ${i <= at ? "text-ink" : "text-muted"}`}>
          <span className={`tabular grid size-5 place-items-center rounded-full text-[11px] font-medium ${i < at ? "bg-accent text-accent-ink" : i === at ? "border border-accent text-accent" : "border border-line-strong"}`}>{i + 1}</span>
          <span className="max-sm:hidden">{s}</span>
        </li>
      ))}
    </ol>
  );
}

export default async function ConnectPage({ searchParams }: { searchParams: Promise<{ step?: string; sample?: string }> }) {
  const user = await requireUser();
  const { step, sample } = await searchParams;
  const gmail = db.prepare(`SELECT backfill_state FROM google_accounts WHERE user_id = ?`).get(user.id) as { backfill_state: string } | undefined;
  const months = Math.round(Number(process.env.BACKFILL_DAYS ?? 180) / 30);

  if (step === "scan") {
    const counts = await scanCounts();
    return (
      <div className="mx-auto max-w-xl space-y-6 py-4">
        <Steps at={2} />
        <h1 className="h-page">{gmail && gmail.backfill_state !== "done" ? "Reading your application email" : "Your pipeline is ready"}</h1>
        <ScanProgress initial={counts} scanning={Boolean(gmail && gmail.backfill_state !== "done")} months={months} />
      </div>
    );
  }

  if (step === "gmail") {
    return (
      <div className="mx-auto max-w-2xl space-y-6 py-4">
        <Steps at={1} />
        <div>
          <h1 className="h-page">Before you connect Gmail</h1>
          <p className="mt-1 text-[14px] text-muted">Google will ask you to allow read-only access. Here is exactly what that means.</p>
        </div>
        <div className="card space-y-5 p-5"><TrustBlocks compact /></div>
        <p className="text-[14px] text-ink-2">{TRUST.expectations}</p>
        <div className="flex flex-wrap items-center gap-3">
          {googleConfigured() ? (
            <a href="/api/google/connect" className="btn btn-primary">Continue to Google</a>
          ) : (
            <p className="text-[14px] text-ink-2">Gmail isn&apos;t set up on this server yet. <Link className="text-accent underline" href="/app/connect?step=forward">Use forwarding instead</Link>.</p>
          )}
          <Link href="/app/connect" className="btn btn-ghost">Back</Link>
        </div>
        <LimitedUse />
      </div>
    );
  }

  if (step === "forward") {
    return (
      <div className="mx-auto max-w-2xl space-y-6 py-4">
        <Steps at={1} />
        <div>
          <h1 className="h-page">Forward application emails</h1>
          <p className="mt-1 text-[14px] text-muted">{TRUST.alternative}</p>
        </div>
        <div className="card space-y-4 p-5">
          <div>
            <p className="label">Your private address</p>
            <CopyField value={inboundAddress(user.inbound_code)} />
          </div>
          <ol className="list-decimal space-y-1.5 pl-5 text-[14px] text-ink-2">
            <li>Forward any application email to this address. Pursuit reads the original sender, so forwarded mail works.</li>
            <li>Optional: in Gmail, create a filter for mail from <code className="text-[12px]">greenhouse.io OR lever.co OR myworkday.com</code> that forwards here automatically.</li>
            <li>You get a short receipt each time an email is added, so you know it worked.</li>
          </ol>
        </div>
        <div className="flex gap-2">
          <Link href="/app" className="btn btn-primary">Done</Link>
          <Link href="/app/connect" className="btn btn-ghost">Back</Link>
        </div>
      </div>
    );
  }

  if (step === "import") {
    return (
      <div className="mx-auto max-w-2xl space-y-6 py-4">
        <Steps at={1} />
        <h1 className="h-page">Import a file</h1>
        <div className="card space-y-3 p-5">
          <p className="text-[14px] text-ink-2">Upload JSON in the form <code className="text-[12px]">{"{ \"messages\": [{ id, threadId, from, subject, date, body, direction }] }"}</code>.</p>
          <ImportForm />
        </div>
        <div className="flex gap-2">
          <Link href="/app/connect?step=scan" className="btn btn-primary">Continue</Link>
          <Link href="/app/connect" className="btn btn-ghost">Back</Link>
        </div>
      </div>
    );
  }

  const paths = [
    { href: "/app/connect?step=gmail", icon: MailIcon, title: "Connect Gmail, read-only", body: "Pursuit finds every application from the last six months and keeps up from there.", tag: "Recommended" },
    { href: "/app/connect?step=forward", icon: SendIcon, title: "Forward emails instead", body: "Send application emails to a private address. No inbox access." },
    { href: "/app/connect?step=import", icon: UploadIcon, title: "Import a file", body: "Bring email from an export or another tool as JSON." },
  ];
  return (
    <div className="mx-auto max-w-2xl space-y-6 py-4">
      <Steps at={0} />
      <div>
        <h1 className="h-page">Welcome, {user.name.split(" ")[0]}. How should Pursuit find your applications?</h1>
        <p className="mt-1 text-[14px] text-muted">You can add the others later in Settings.</p>
      </div>
      <ul className="space-y-2">
        {paths.map((p) => (
          <li key={p.href}>
            <Link href={p.href} className="card flex items-start gap-4 p-4 transition-colors hover:border-line-strong">
              <p.icon size={20} className="mt-0.5 shrink-0 text-accent" />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 text-[14px] font-medium">{p.title}{p.tag && <span className="chip">{p.tag}</span>}</span>
                <span className="mt-0.5 block text-[14px] text-muted">{p.body}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <div className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3 ${sample ? "border-accent" : "border-dashed border-line-strong"}`}>
        <p className="text-[14px] text-ink-2">Not ready to connect anything? Try Pursuit with a fictional inbox first.</p>
        <SampleDataButton className={sample ? "btn btn-primary btn-sm" : undefined} />
      </div>
    </div>
  );
}
