import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { currentUser } from "@/lib/auth";
import { authUrl, googleConfigured } from "@/lib/gmail";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await currentUser();
  if (!user) return Response.redirect(new URL("/login", req.url));
  if (!googleConfigured()) return Response.redirect(new URL("/app/settings?error=google-not-configured", req.url));
  const state = randomBytes(24).toString("base64url");
  (await cookies()).set("pursuit_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && !process.env.INSECURE_COOKIES,
    path: "/",
    maxAge: 600,
  });
  return Response.redirect(authUrl(state));
}
