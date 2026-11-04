import { timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import { parsePostmark } from "@/lib/forward";
import { ingest } from "@/lib/ingest";

export const dynamic = "force-dynamic";

function secretOk(req: Request): boolean {
  const secret = process.env.INBOUND_SECRET;
  if (!secret) return false;
  const given = new URL(req.url).searchParams.get("secret") ?? "";
  const a = Buffer.from(given), b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  if (!secretOk(req)) return new Response("Unauthorized", { status: 401 });
  const { to, email } = parsePostmark(await req.json());
  const domain = (process.env.INBOUND_DOMAIN ?? "").toLowerCase();
  const code = to.map((a) => a.split("@")).find(([, h]) => !domain || h === domain)?.[0]?.split("+")[0];
  const user = code ? (db.prepare(`SELECT id FROM users WHERE inbound_code = ?`).get(code.toLowerCase()) as { id: string } | undefined) : undefined;
  if (!user) return Response.json({ ok: true, ignored: "unknown recipient" });
  const { added } = await ingest(user.id, [{ ...email, source: "forward" }]);
  return Response.json({ ok: true, added });
}
