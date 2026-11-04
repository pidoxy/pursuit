import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

function key(): Buffer {
  const secret = process.env.APP_SECRET;
  if (!secret || secret.length < 16) {
    if (process.env.NODE_ENV === "production") throw new Error("APP_SECRET (16+ chars) is required to store Gmail tokens.");
    return createHash("sha256").update("pursuit-dev-only-secret").digest();
  }
  return createHash("sha256").update(secret).digest();
}

/** AES-256-GCM; output is base64(iv | tag | ciphertext). */
export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), enc]).toString("base64");
}

export function decrypt(blob: string): string {
  const b = Buffer.from(blob, "base64");
  const d = createDecipheriv("aes-256-gcm", key(), b.subarray(0, 12));
  d.setAuthTag(b.subarray(12, 28));
  return Buffer.concat([d.update(b.subarray(28)), d.final()]).toString("utf8");
}
