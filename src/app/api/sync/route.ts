import { currentUser } from "@/lib/auth";
import { syncUser } from "@/lib/gmail";

export const dynamic = "force-dynamic";

export async function POST() {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Sign in" }, { status: 401 });
  void syncUser(user.id);
  return Response.json({ ok: true, started: true });
}
