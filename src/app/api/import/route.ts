import { currentUser } from "@/lib/auth";
import { ingest } from "@/lib/ingest";
import type { RawEmail } from "@/lib/types";

export const dynamic = "force-dynamic";

interface ImportMsg {
  id: string;
  threadId?: string | null;
  from: string;
  fromName?: string | null;
  to?: string;
  subject?: string;
  date: string;
  snippet?: string | null;
  body?: string | null;
  direction?: "in" | "out";
}

/** JSON import: { messages: ImportMsg[] } — e.g. an export from another tool or a Gmail takeout conversion. */
export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Sign in" }, { status: 401 });
  let data: { messages?: ImportMsg[] };
  try {
    data = await req.json();
  } catch {
    return Response.json({ error: "That file isn't valid JSON." }, { status: 400 });
  }
  const msgs = Array.isArray(data.messages) ? data.messages.slice(0, 5000) : [];
  if (!msgs.length) return Response.json({ error: "No messages found. Expected { \"messages\": [...] }." }, { status: 400 });
  const emails: RawEmail[] = [];
  for (const m of msgs) {
    const date = new Date(m.date);
    if (!m.id || !m.from || isNaN(date.getTime())) continue;
    const from = (m.from.match(/<([^>]+)>/)?.[1] ?? m.from).trim().toLowerCase();
    emails.push({
      source: "import",
      extId: String(m.id),
      threadId: m.threadId ?? null,
      direction: m.direction === "out" ? "out" : "in",
      from,
      fromName: m.fromName ?? m.from.match(/^\s*"?([^"<]*?)"?\s*</)?.[1]?.trim() ?? null,
      to: m.to ?? "",
      subject: m.subject ?? "",
      snippet: m.snippet ?? null,
      body: m.body ?? m.snippet ?? "",
      date,
    });
  }
  const { added } = await ingest(user.id, emails);
  return Response.json({ ok: true, received: msgs.length, added });
}
