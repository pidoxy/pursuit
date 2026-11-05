import Link from "next/link";
import { OPERATOR } from "@/lib/operator";

export const metadata = { title: "Terms of service" };

export default function Terms() {
  return (
    <>
      <h1 className="h-page text-ink">Terms of service</h1>
      <p className="text-[13px] text-muted">Effective {OPERATOR.effective}. Operated by {OPERATOR.name}.</p>

      <h2>Using Pursuit</h2>
      <p>Pursuit helps you track your own applications. You need an account, you are responsible for keeping your password safe, and you may only connect email accounts you own or are allowed to use.</p>

      <h2>Your content</h2>
      <p>Your email, notes and answers stay yours. You give us permission to process them only to run Pursuit for you, as described in the <Link className="text-accent underline" href="/privacy">privacy policy</Link>.</p>

      <h2>What Pursuit does and doesn&apos;t do</h2>
      <p>Pursuit reads email with read-only access and never sends email for you; drafts open in your own mail app. Detection is automatic and can be wrong. Check important dates and decisions against the original email, which Pursuit always links to. Pursuit is not responsible for missed deadlines or outcomes of any application.</p>

      <h2>Acceptable use</h2>
      <p>Don&apos;t misuse the service. That means no attempts to break its security, no overloading it, no access to other people&apos;s data, and no use for anything unlawful.</p>

      <h2>Availability and changes</h2>
      <p>Pursuit is provided &ldquo;as is&rdquo;, without warranties, and may change or stop. If we shut it down, we will give reasonable notice so you can export your data.</p>

      <h2>Liability</h2>
      <p>To the extent the law allows, the operator is not liable for indirect or consequential losses arising from your use of Pursuit.</p>

      <h2>Ending your account</h2>
      <p>You can delete your account at any time in Settings. We may suspend accounts that break these terms.</p>

      <h2>Contact</h2>
      <p>{OPERATOR.contact ? <a className="text-accent underline" href={`mailto:${OPERATOR.contact}`}>{OPERATOR.contact}</a> : "Use the contact address listed by the operator."}</p>
    </>
  );
}
