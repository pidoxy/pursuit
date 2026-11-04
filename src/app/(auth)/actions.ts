"use server";

import { redirect } from "next/navigation";
import { createSession, hashPassword, verifyPassword } from "@/lib/auth";
import { db } from "@/lib/db";
import { id, token } from "@/lib/ids";
import { isValidTimeZone } from "@/lib/time";

export type AuthState = { error?: string } | undefined;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function safeNext(next: FormDataEntryValue | null): string | null {
  const s = typeof next === "string" ? next : "";
  return s.startsWith("/") && !s.startsWith("//") ? s : null;
}

export async function signup(_prev: AuthState, form: FormData): Promise<AuthState> {
  const name = String(form.get("name") ?? "").trim().slice(0, 60);
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const tz = String(form.get("timezone") ?? "UTC");
  if (!name) return { error: "What should we call you?" };
  if (!EMAIL.test(email)) return { error: "That email doesn't look right." };
  if (password.length < 8) return { error: "Use at least 8 characters for your password." };
  if (db.prepare(`SELECT 1 FROM users WHERE email = ?`).get(email)) {
    return { error: "There's already an account with that email. Try signing in." };
  }
  const uid = id("usr");
  db.prepare(`INSERT INTO users (id, email, name, password_hash, timezone, inbound_code) VALUES (?, ?, ?, ?, ?, ?)`).run(
    uid,
    email,
    name,
    await hashPassword(password),
    isValidTimeZone(tz) ? tz : "UTC",
    token(10),
  );
  await createSession(uid);
  redirect(safeNext(form.get("next")) ?? "/app/settings?welcome=1");
}

export async function login(_prev: AuthState, form: FormData): Promise<AuthState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const row = db.prepare(`SELECT id, password_hash FROM users WHERE email = ?`).get(email) as
    | { id: string; password_hash: string }
    | undefined;
  if (!row || !(await verifyPassword(password, row.password_hash))) {
    return { error: "Email or password is incorrect." };
  }
  await createSession(row.id);
  redirect(safeNext(form.get("next")) ?? "/app");
}
