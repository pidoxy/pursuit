import { requireUser } from "@/lib/auth";
import { claudeAvailable, MODEL } from "@/lib/classify/claude";
import { db } from "@/lib/db";
import { googleConfigured, redirectUri } from "@/lib/gmail";
import { mailConfigured } from "@/lib/mailer";
import { inboundAddress } from "@/lib/urls";
import { ActionButton } from "@/components/action-button";
import { AutoRefresh } from "@/components/auto-refresh";
import { SyncButton } from "@/components/sync-button";
import { deleteAccount, disconnectGmail, rotateInbound } from "../actions";
import { CopyField, ImportForm, PrefsForm } from "./forms";

export const metadata = { title: "Settings" };

function Section({ id, title, desc, children }: { id?: string; title: string; desc?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section id={id} className="card scroll-mt-24 p-5 sm:p-6">
      <h2 className="text-lg font-semibold">{title}</h2>
      {desc && <div className="mt-1 text-sm text-ink-2">{desc}</div>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

const ERRORS: Record<string, string> = {
  "google-not-configured": "Gmail connection isn't set up on this server yet (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET).",
  "google-denied": "Google access was cancelled.",
  "google-state": "That sign-in link expired. Please try again.",
};

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ welcome?: string; connected?: string; error?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const gmail = db.prepare(`SELECT email, backfill_state, last_sync_at, last_error FROM google_accounts WHERE user_id = ?`).get(user.id) as
    | { email: string; backfill_state: string; last_sync_at: string | null; last_error: string | null }
    | undefined;
  const { n: msgCount } = db.prepare(`SELECT COUNT(*) n FROM messages WHERE user_id = ?`).get(user.id) as { n: number };
  const syncing = gmail && gmail.backfill_state !== "done";
  const inbound = inboundAddress(user.inbound_code);

  return (
    <div className="space-y-6">
      <AutoRefresh active={Boolean(syncing)} ms={4000} />
      <div>
        <h1 className="h-display text-3xl">Settings</h1>
        <p className="mt-1 text-ink-2">{user.email}</p>
      </div>

      {sp.welcome && (
        <div className="rounded-xl border border-accent/30 bg-accent-soft p-4 text-sm">
          <strong>Welcome to Pursuit.</strong> Connect Gmail below and your pipeline builds itself from the last six months of email. Prefer not to? Forward application emails or import a file instead.
        </div>
      )}
      {sp.connected && <p className="rounded-xl bg-sage-soft px-4 py-3 text-sm text-sage">Gmail connected. Pursuit is reading your application email now — this takes a minute or two.</p>}
      {sp.error && <p className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">{ERRORS[sp.error] ?? sp.error}</p>}

      <Section
        title="Gmail"
        desc="Read-only. Pursuit only keeps application email, replies in those threads, and your sent mail (to know who owes you an answer). It never sends, deletes or labels anything."
      >
        {gmail ? (
          <div className="space-y-3">
            <p className="text-sm">
              Connected as <strong>{gmail.email}</strong> ·{" "}
              {syncing ? <span className="animate-pulse-soft font-semibold text-accent">Reading your email…</span> : gmail.last_sync_at ? `last synced ${new Date(gmail.last_sync_at).toLocaleString("en-GB", { timeZone: user.timezone, dateStyle: "medium", timeStyle: "short" })}` : "not synced yet"}
              {" "}· {msgCount} emails tracked
            </p>
            {gmail.last_error && <p className="text-sm text-danger">Last error: {gmail.last_error}</p>}
            <div className="flex flex-wrap gap-2">
              <SyncButton />
              <ActionButton action={disconnectGmail} className="btn btn-ghost btn-sm text-danger" confirmText="Disconnect Gmail? Already-tracked opportunities stay.">Disconnect</ActionButton>
            </div>
          </div>
        ) : googleConfigured() ? (
          <a href="/api/google/connect" className="btn btn-primary">Connect Gmail (read-only)</a>
        ) : (
          <div className="space-y-2 text-sm text-ink-2">
            <p>Gmail connection needs a Google OAuth client on this server. Until then, use forwarding or import below.</p>
            <details>
              <summary className="cursor-pointer font-semibold">Set it up (server admin)</summary>
              <ol className="mt-2 list-decimal space-y-1 pl-5">
                <li>In Google Cloud Console, create a project and enable the <em>Gmail API</em>.</li>
                <li>OAuth consent screen: External, add the scope <code>gmail.readonly</code>, add yourself as a test user.</li>
                <li>Create an OAuth client (Web application) with redirect URI <code>{redirectUri()}</code>.</li>
                <li>Set <code>GOOGLE_CLIENT_ID</code>, <code>GOOGLE_CLIENT_SECRET</code> and <code>APP_SECRET</code>, then restart.</li>
              </ol>
            </details>
          </div>
        )}
      </Section>

      <Section
        id="forward"
        title="Forwarding address"
        desc={<>Forward any application email here — or create a Gmail filter that auto-forwards mail from hiring platforms (Greenhouse, Lever, Workday…) to it.</>}
      >
        <CopyField value={inbound} />
        <ActionButton action={rotateInbound} className="btn btn-ghost btn-sm mt-3 text-danger" confirmText="Create a new address? The old one stops working.">Change address</ActionButton>
      </Section>

      <Section id="import" title="Import" desc={<>Upload a JSON file of emails: <code>{"{ \"messages\": [{ id, threadId, from, subject, date, body, direction }] }"}</code>.</>}>
        <ImportForm />
      </Section>

      <Section title="Preferences">
        <PrefsForm name={user.name} timezone={user.timezone} followup={user.followup_days} stale={user.stale_days} brief={user.brief_enabled === 1} />
      </Section>

      <Section title="System">
        <dl className="grid gap-3 text-sm sm:grid-cols-3">
          <div><dt className="text-muted">Email understanding</dt><dd className="font-semibold">{claudeAvailable() ? `Claude (${MODEL}) + rules` : "Built-in rules"}</dd></div>
          <div><dt className="text-muted">Morning brief email</dt><dd className="font-semibold">{mailConfigured() ? "On" : "Not configured"}</dd></div>
          <div><dt className="text-muted">Gmail OAuth</dt><dd className="font-semibold">{googleConfigured() ? "Configured" : "Not configured"}</dd></div>
        </dl>
      </Section>

      <Section title="Your data">
        <div className="flex flex-wrap gap-2">
          <a href="/api/export" className="btn btn-secondary">Export everything (JSON)</a>
          <ActionButton action={deleteAccount} className="btn btn-ghost text-danger" confirmText="Delete your account and all data permanently? This can't be undone.">Delete account</ActionButton>
        </div>
      </Section>
    </div>
  );
}
