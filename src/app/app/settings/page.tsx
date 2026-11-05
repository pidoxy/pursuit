import { requireUser } from "@/lib/auth";
import { isPaused } from "@/lib/brief";
import { claudeAvailable, MODEL } from "@/lib/classify/claude";
import { db } from "@/lib/db";
import { googleConfigured, redirectUri } from "@/lib/gmail";
import { userRules } from "@/lib/ingest";
import { mailConfigured } from "@/lib/mailer";
import { inboundAddress } from "@/lib/urls";
import { ActionButton } from "@/components/action-button";
import { AutoRefresh } from "@/components/auto-refresh";
import { ConfirmAction } from "@/components/confirm-action";
import { SyncButton } from "@/components/sync-button";
import { LimitedUse, TrustBlocks } from "@/components/trust";
import { deleteAccount, deleteRule, disconnectGmail, pauseNotifications, rotateInbound } from "../actions";
import { CopyField, ImportForm, NotificationsForm, PrefsForm, RuleForm } from "./forms";

export const metadata = { title: "Settings" };

function Section({ id, title, desc, children }: { id?: string; title: string; desc?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 border-t border-line pt-6 first:border-0 first:pt-0" aria-label={title}>
      <div className="grid gap-4 lg:grid-cols-[260px_1fr] lg:gap-10">
        <div>
          <h2 className="h-section">{title}</h2>
          {desc && <div className="mt-1 text-[13px] leading-5 text-muted">{desc}</div>}
        </div>
        <div className="min-w-0">{children}</div>
      </div>
    </section>
  );
}

const ERRORS: Record<string, string> = {
  "google-not-configured": "Gmail connection isn't set up on this server yet (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET).",
  "google-denied": "Google access was cancelled. Nothing was connected.",
  "google-state": "That sign-in link expired. Please try again.",
};

const RULE_LABEL: Record<string, string> = { ignore_sender: "Ignore sender", ignore_domain: "Ignore domain", org_alias: "Rename organisation" };

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ welcome?: string; connected?: string; error?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const gmail = db.prepare(`SELECT email, backfill_state, last_sync_at, last_error FROM google_accounts WHERE user_id = ?`).get(user.id) as
    | { email: string; backfill_state: string; last_sync_at: string | null; last_error: string | null }
    | undefined;
  const { n: msgCount } = db.prepare(`SELECT COUNT(*) n FROM messages WHERE user_id = ?`).get(user.id) as { n: number };
  const syncing = gmail && gmail.backfill_state !== "done";
  const inbound = inboundAddress(user.inbound_code);
  const rules = userRules(user.id);
  const paused = isPaused(user);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <AutoRefresh active={Boolean(syncing)} ms={4000} />
      <div>
        <h1 className="h-page">Settings</h1>
        <p className="mt-1 text-[14px] text-muted">{user.email}</p>
      </div>

      {sp.connected && <p className="rounded-lg border border-line bg-surface px-4 py-3 text-[14px]">Gmail connected. Pursuit is reading your application email now; this takes a minute or two.</p>}
      {sp.error && <p className="rounded-lg border border-line bg-surface px-4 py-3 text-[14px] text-ink-2">{ERRORS[sp.error] ?? sp.error}</p>}

      <Section title="Gmail" desc="Read-only. Pursuit can't send, delete, label or change anything.">
        {gmail ? (
          <div className="space-y-3">
            <p className="text-[14px]">
              Connected as <span className="font-medium">{gmail.email}</span> ·{" "}
              {syncing ? <span className="font-medium text-accent">Reading your email…</span> : gmail.last_sync_at ? `last synced ${new Date(gmail.last_sync_at).toLocaleString("en-GB", { timeZone: user.timezone, dateStyle: "medium", timeStyle: "short" })}` : "not synced yet"}
              {" "}· <span className="tabular">{msgCount}</span> emails tracked
            </p>
            {gmail.last_error && <p className="text-[14px] text-ink-2">Last error: {gmail.last_error}</p>}
            <div className="flex flex-wrap gap-2">
              <SyncButton />
              <ConfirmAction
                label="Disconnect and delete"
                className="btn btn-ghost btn-sm"
                title="Disconnect Gmail?"
                confirmLabel="Disconnect and delete"
                action={disconnectGmail}
                body={<>
                  <p>This revokes Pursuit&apos;s Google access and deletes everything Pursuit derived from your email: applications it found, their deadlines, drafts and classifications.</p>
                  <p>Applications you added or edited by hand, your people and your answers stay.</p>
                </>}
              />
            </div>
          </div>
        ) : googleConfigured() ? (
          <div className="space-y-4">
            <a href="/app/connect" className="btn btn-primary">Connect Gmail, read-only</a>
          </div>
        ) : (
          <div className="space-y-2 text-[14px] text-ink-2">
            <p>Gmail connection needs a Google OAuth client on this server. Until then, use forwarding or import below.</p>
            <details>
              <summary className="cursor-pointer font-medium">Set it up (server admin)</summary>
              <ol className="mt-2 list-decimal space-y-1 pl-5">
                <li>In Google Cloud Console, create a project and enable the <em>Gmail API</em>.</li>
                <li>OAuth consent screen: External, add the scope <code>gmail.readonly</code>, add yourself as a test user.</li>
                <li>Create an OAuth client (Web application) with redirect URI <code>{redirectUri()}</code>.</li>
                <li>Set <code>GOOGLE_CLIENT_ID</code>, <code>GOOGLE_CLIENT_SECRET</code> and <code>APP_SECRET</code>, then restart.</li>
              </ol>
            </details>
          </div>
        )}
        <div className="mt-5 space-y-4 rounded-lg border border-line p-4">
          <TrustBlocks compact />
          <LimitedUse />
        </div>
      </Section>

      <Section id="notifications" title="Notifications" desc="One digest a day by default. Interviews and deadlines under 48 hours can reach you right away. Closings never notify you.">
        {paused && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line px-4 py-3 text-[14px]">
            <span>Paused until <span className="tabular font-medium">{user.paused_until!.slice(0, 10)}</span>.</span>
            <ActionButton action={pauseNotifications.bind(null, null)}>Resume now</ActionButton>
          </div>
        )}
        <NotificationsForm
          brief={user.brief_enabled === 1}
          cadence={user.digest_cadence}
          hour={user.digest_hour}
          realtime={user.realtime_enabled === 1}
          mail={mailConfigured()}
        />
        {!paused && (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <ActionButton action={pauseNotifications.bind(null, 7)}>Pause notifications for a week</ActionButton>
            <span className="text-[12px] text-muted">Everything resumes on its own after 7 days.</span>
          </div>
        )}
      </Section>

      <Section id="forward" title="Forwarding address" desc="Forward any application email here, or set a Gmail filter to auto-forward mail from hiring platforms. You get a short receipt for each one.">
        <CopyField value={inbound} />
        <div className="mt-3">
          <ConfirmAction
            label="Change address"
            className="btn btn-ghost btn-sm"
            title="Create a new forwarding address?"
            confirmLabel="Create new address"
            action={rotateInbound}
            body={<p>The current address stops working right away. Update any Gmail filters that forward to it.</p>}
          />
        </div>
      </Section>

      <Section id="import" title="Import" desc={<>A JSON file of emails: <code className="text-[12px]">{"{ \"messages\": [...] }"}</code></>}>
        <ImportForm />
      </Section>

      <Section id="rules" title="Rules" desc="Senders Pursuit should skip, and names it should correct. Rules are narrow: one sender or one domain at a time.">
        {rules.length > 0 && (
          <ul className="mb-4 divide-y divide-line rounded-lg border border-line">
            {rules.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 px-3 py-2 text-[14px]">
                <span className="min-w-0 truncate">
                  <span className="text-muted">{RULE_LABEL[r.kind]}:</span> {r.match}{r.value ? <> → <span className="font-medium">{r.value}</span></> : null}
                </span>
                <ActionButton action={deleteRule.bind(null, r.id)} className="btn btn-ghost btn-sm">Remove</ActionButton>
              </li>
            ))}
          </ul>
        )}
        <RuleForm />
        <p className="mt-2 text-[12px] text-muted">Tip: add your current employer&apos;s HR domain so Pursuit never reads internal HR mail.</p>
      </Section>

      <Section title="Preferences">
        <PrefsForm name={user.name} timezone={user.timezone} followup={user.followup_days} stale={user.stale_days} />
      </Section>

      <Section title="System">
        <dl className="grid gap-3 text-[14px] sm:grid-cols-3">
          <div><dt className="text-[12px] text-muted">Email understanding</dt><dd className="font-medium">{claudeAvailable() ? `Claude (${MODEL}) + rules` : "Built-in rules"}</dd></div>
          <div><dt className="text-[12px] text-muted">Email delivery</dt><dd className="font-medium">{mailConfigured() ? "Configured" : "Not configured"}</dd></div>
          <div><dt className="text-[12px] text-muted">Gmail OAuth</dt><dd className="font-medium">{googleConfigured() ? "Configured" : "Not configured"}</dd></div>
        </dl>
      </Section>

      <Section title="Your data" desc="Export everything any time. Deleting your account removes all of it.">
        <div className="flex flex-wrap gap-2">
          <a href="/api/export" className="btn btn-secondary">Export everything (JSON)</a>
          <a href="/privacy" className="btn btn-ghost">Privacy policy</a>
          <ConfirmAction
            label="Delete account"
            className="btn btn-ghost"
            title="Delete your account?"
            confirmLabel="Delete everything"
            phrase="delete my account"
            action={deleteAccount}
            body={<p>This permanently deletes your account, every application, task, person, answer and email Pursuit stored, and revokes Google access. It can&apos;t be undone.</p>}
          />
        </div>
      </Section>
    </div>
  );
}
