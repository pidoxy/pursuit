import { randomBytes } from "node:crypto";

const ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789"; // no look-alikes

/** URL-safe random token, ~5 bits/char. */
export function token(length = 24): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

export function id(prefix: string): string {
  return `${prefix}_${token(16)}`;
}

export const PERSON_COLORS = [
  "#D9572B", // ember
  "#3F7FBF", // lake
  "#5E8C6A", // sage
  "#B5489A", // plum
  "#C8961E", // honey
  "#2E9C9C", // teal
  "#7A5CC2", // iris
  "#A35D3A", // clay
];
