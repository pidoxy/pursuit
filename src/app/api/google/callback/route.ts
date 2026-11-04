import { cookies } from "next/headers";
import { currentUser } from "@/lib/auth";
import { connectWithCode, syncUser } from "@/lib/gmail";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const user = await currentUser();
  if (!user) return Response.redirect(new URL("/login", req.url));
  const jar = await cookies();
  const expected = jar.get("pursuit_oauth_state")?.value;
  jar.delete("pursuit_oauth_state");
  const back = (q: string) => Response.redirect(new URL(`/app/settings?${q}`, req.url));
  if (url.searchParams.get("error")) return back("error=google-denied");
  if (!expected || url.searchParams.get("state") !== expected) return back("error=google-state");
  try {
    await connectWithCode(user.id, url.searchParams.get("code") ?? "");
  } catch (err) {
    return back(`error=${encodeURIComponent(err instanceof Error ? err.message : "google-failed")}`);
  }
  void syncUser(user.id); // backfill runs in the background; the UI polls
  return back("connected=1");
}
