import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Sign in" }, { status: 401 });
  const g = db.prepare(`SELECT backfill_state, last_error FROM google_accounts WHERE user_id = ?`).get(user.id) as { backfill_state: string; last_error: string | null } | undefined;
  return Response.json({ connected: Boolean(g), done: !g || g.backfill_state === "done", error: g?.last_error ?? null });
}
