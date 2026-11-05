import { purgeDeleted, runBriefs, runRealtime } from "@/lib/brief";
import { syncAll } from "@/lib/gmail";

export const dynamic = "force-dynamic";

async function handle(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Unauthorized", { status: 401 });
  await syncAll();
  const alerts = await runRealtime();
  const sent = await runBriefs();
  purgeDeleted();
  return Response.json({ ok: true, briefs: sent, alerts });
}

export const GET = handle;
export const POST = handle;
