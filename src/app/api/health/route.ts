import { db } from "@/lib/db";
import { claudeAvailable } from "@/lib/classify/claude";
import { googleConfigured } from "@/lib/gmail";

export const dynamic = "force-dynamic";

export function GET() {
  db.prepare("SELECT 1").get();
  return Response.json({ ok: true, ai: claudeAvailable() ? "claude" : "rules", gmail: googleConfigured() });
}
