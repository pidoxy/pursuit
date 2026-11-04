import { htmlToText } from "./ingest";
import type { RawEmail } from "./types";

interface PostmarkPayload {
  MessageID?: string;
  From?: string;
  FromFull?: { Email?: string; Name?: string };
  To?: string;
  ToFull?: { Email?: string }[];
  OriginalRecipient?: string;
  Subject?: string;
  Date?: string;
  TextBody?: string;
  HtmlBody?: string;
  Headers?: { Name: string; Value: string }[];
}

const addr = (s: string) => (s.match(/<([^>]+)>/)?.[1] ?? s).trim().toLowerCase();

/**
 * A manually forwarded email ("Fwd: ...") carries the original sender in the body.
 * Gmail auto-forward filters keep the original From header, so nothing to unwrap there.
 */
export function unwrapForwarded(subject: string, body: string): { from: string; fromName: string | null; subject: string; body: string; date: Date | null } | null {
  if (!/^(fwd?|fw):/i.test(subject) && !/-{5,}\s*Forwarded message/i.test(body)) return null;
  const m = body.match(/(?:-{5,}\s*Forwarded message\s*-{5,}|Begin forwarded message:)\s*\n([\s\S]*)/i);
  const block = m ? m[1] : body;
  const from = block.match(/^From:\s*(.+)$/im)?.[1]?.trim();
  if (!from) return null;
  const name = from.match(/^\s*"?([^"<]*?)"?\s*</)?.[1]?.trim() || null;
  const subj = block.match(/^Subject:\s*(.+)$/im)?.[1]?.trim() ?? subject.replace(/^(fwd?|fw):\s*/i, "");
  const dateStr = block.match(/^Date:\s*(.+)$/im)?.[1]?.trim();
  const date = dateStr ? new Date(dateStr.replace(/ at /, " ")) : null;
  const rest = block.split(/\n\s*\n/).slice(1).join("\n\n");
  return { from: addr(from), fromName: name, subject: subj, body: rest || block, date: date && !isNaN(date.getTime()) ? date : null };
}

export function parsePostmark(p: PostmarkPayload): { to: string[]; email: Omit<RawEmail, "source"> } {
  const to = [...(p.ToFull?.map((t) => t.Email ?? "") ?? []), ...(p.To ? p.To.split(",") : []), p.OriginalRecipient ?? ""]
    .map(addr)
    .filter(Boolean);
  const body = p.TextBody?.trim() || (p.HtmlBody ? htmlToText(p.HtmlBody) : "");
  const subject = (p.Subject ?? "").trim();
  const date = p.Date ? new Date(p.Date) : new Date();
  const unwrapped = unwrapForwarded(subject, body);
  const fromAddr = addr(p.FromFull?.Email ?? p.From ?? "");
  return {
    to: [...new Set(to)],
    email: {
      extId: p.MessageID ?? `${fromAddr}:${subject}:${p.Date ?? ""}`,
      threadId: null,
      direction: "in",
      from: unwrapped?.from ?? fromAddr,
      fromName: unwrapped?.fromName ?? p.FromFull?.Name ?? null,
      to: p.To ?? "",
      subject: unwrapped?.subject ?? subject,
      snippet: null,
      body: unwrapped?.body ?? body,
      date: unwrapped?.date ?? (isNaN(date.getTime()) ? new Date() : date),
    },
  };
}
