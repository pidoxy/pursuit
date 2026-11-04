import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await currentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const q = (t: string) => db.prepare(`SELECT * FROM ${t} WHERE user_id = ?`).all(user.id);
  const body = JSON.stringify(
    { exportedAt: new Date().toISOString(), opportunities: q("opportunities"), events: q("events"), tasks: q("tasks"), people: q("people"), asks: q("asks"), snippets: q("snippets") },
    null,
    2,
  );
  return new Response(body, {
    headers: { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="pursuit-export.json"` },
  });
}
