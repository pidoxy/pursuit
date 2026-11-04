export function appUrl(): string {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

export function inboundAddress(code: string): string {
  return `${code}@${process.env.INBOUND_DOMAIN || "inbound.example.com"}`;
}

/** Deep link to a Gmail thread (works for the signed-in account). */
export function gmailLink(threadId: string | null, extId?: string | null): string | null {
  const ref = threadId ?? extId;
  return ref ? `https://mail.google.com/mail/u/0/#all/${ref}` : null;
}
