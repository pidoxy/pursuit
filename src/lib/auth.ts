import "server-only";
import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "./db";
import type { User } from "./types";

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;
const COOKIE = "pursuit_session";
const SESSION_DAYS = 30;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, saltHex, keyHex] = stored.split("$");
  if (scheme !== "scrypt" || !saltHex || !keyHex) return false;
  const key = await scrypt(password, Buffer.from(saltHex, "hex"), 64);
  const expected = Buffer.from(keyHex, "hex");
  return expected.length === key.length && timingSafeEqual(expected, key);
}

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

export async function createSession(userId: string) {
  const raw = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + SESSION_DAYS * 86400_000);
  db.prepare(`INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)`).run(
    sha(raw),
    userId,
    expires.toISOString(),
  );
  const jar = await cookies();
  jar.set(COOKIE, raw, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && !process.env.INSECURE_COOKIES,
    path: "/",
    expires,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const raw = jar.get(COOKIE)?.value;
  if (raw) db.prepare(`DELETE FROM sessions WHERE id = ?`).run(sha(raw));
  jar.delete(COOKIE);
}

const USER_COLS = `u.id, u.email, u.name, u.timezone, u.inbound_code, u.followup_days, u.stale_days, u.brief_enabled`;

export async function currentUser(): Promise<User | null> {
  const jar = await cookies();
  const raw = jar.get(COOKIE)?.value;
  if (!raw) return null;
  const row = db
    .prepare(`SELECT ${USER_COLS}, s.expires_at FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ?`)
    .get(sha(raw)) as (User & { expires_at: string }) | undefined;
  if (!row) return null;
  if (new Date(row.expires_at) < new Date()) {
    db.prepare(`DELETE FROM sessions WHERE id = ?`).run(sha(raw));
    return null;
  }
  const { expires_at: _expires, ...user } = row;
  void _expires;
  return user;
}

/** For pages and actions inside the app. */
export async function requireUser(): Promise<User> {
  const user = await currentUser();
  if (!user) redirect("/login");
  return user;
}
