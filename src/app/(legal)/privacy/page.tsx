import Link from "next/link";
import { OPERATOR } from "@/lib/operator";
import { TRUST } from "@/components/trust";

export const metadata = { title: "Privacy policy" };

export default function Privacy() {
  const contact = OPERATOR.contact ? <a className="text-accent underline" href={`mailto:${OPERATOR.contact}`}>{OPERATOR.contact}</a> : "the contact address listed by the operator";
  return (
    <>
      <h1 className="h-page text-ink">Privacy policy</h1>
      <p className="text-[13px] text-muted">Effective {OPERATOR.effective}. Operated by {OPERATOR.name}.</p>

      <h2>The short version</h2>
      <ul>
        <li><strong>What Pursuit reads.</strong> {TRUST.reads}</li>
        <li><strong>What Pursuit never does.</strong> {TRUST.never}</li>
        <li><strong>How to leave.</strong> {TRUST.leave}</li>
      </ul>

      <h2>Information we collect</h2>
      <ul>
        <li><strong>Account details:</strong> your name, email address, timezone and a scrypt hash of your password.</li>
        <li>
          <strong>Email, if you connect Gmail:</strong> read-only access (the <code>gmail.readonly</code> scope). Pursuit stores application-related messages, replies in those threads, and your sent mail in the same period (needed to know who owes whom a reply). For each message we keep the sender, recipients, subject, date and up to 8 KB of body text. Attachments are not stored. Other email is read only to decide that it is unrelated, and is not kept.
        </li>
        <li><strong>Email you forward or import:</strong> the same fields, for messages you choose to send us.</li>
        <li><strong>What Pursuit derives:</strong> applications, stages, deadlines, tasks, people you asked for letters or reviews, and the sentence each detection was based on.</li>
        <li><strong>What you add:</strong> notes, answers, people, rules and settings.</li>
      </ul>

      <h2>How we use it</h2>
      <p>Only to provide Pursuit to you: building your pipeline, reminders, drafts you send yourself, digest and alert emails you can turn off, and keeping the service secure. We do not sell your data, use it for advertising, or let humans read your email, except when you ask us to for support, when required for security, or when required by law.</p>

      <h2>Google user data</h2>
      <p>{TRUST.limitedUse}</p>
      <p>We do not transfer Google user data to others except as needed to provide or improve Pursuit&apos;s user-facing features, to comply with law, or as part of a merger or acquisition with notice to you. We do not use it to develop, improve or train generalized AI or machine-learning models.</p>

      <h2>AI processing</h2>
      <p>By default, Pursuit classifies email with built-in rules on its own server. If the operator enables it, the text of application-related emails may be sent to Anthropic&apos;s API to improve extraction. That processing is used only to return a result to Pursuit, and under Anthropic&apos;s commercial terms the content is not used to train models. Email content is always treated as data, never as instructions.</p>

      <h2>Storage and security</h2>
      <ul>
        <li>Data is stored in a database on the operator&apos;s server, with Gmail tokens encrypted at rest (AES-256-GCM).</li>
        <li>Connections use HTTPS, and session cookies are httpOnly.</li>
        <li>Daily database backups are kept for 7 days.</li>
      </ul>

      <h2>Retention and deletion</h2>
      <ul>
        <li>Items you delete are kept for 24 hours so you can undo, then removed.</li>
        <li>Disconnecting Gmail revokes access and deletes everything derived from it.</li>
        <li>Deleting your account removes all of your data immediately; backups containing it expire within 7 days.</li>
        <li>You can export everything as JSON from Settings at any time.</li>
      </ul>

      <h2>Service providers</h2>
      <p>The hosting provider that runs the server, the email provider that delivers digests and alerts, the inbound email provider if you use a forwarding address, and Anthropic if AI extraction is enabled. Each receives only what it needs for that job.</p>

      <h2>Your rights</h2>
      <p>You can access, correct, export or delete your data in the app, or by contacting {contact}. You can revoke Google access at any time from Settings or at <a className="text-accent underline" href="https://myaccount.google.com/permissions">myaccount.google.com/permissions</a>.</p>

      <h2>Children</h2>
      <p>Pursuit is not intended for anyone under 16.</p>

      <h2>Changes</h2>
      <p>If this policy changes in a way that matters, we will tell you by email or in the app before it takes effect.</p>

      <p className="pt-4 text-[13px]"><Link className="text-accent underline" href="/terms">Terms of service</Link></p>
    </>
  );
}
