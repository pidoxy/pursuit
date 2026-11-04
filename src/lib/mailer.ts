import "server-only";
import nodemailer, { type Transporter } from "nodemailer";

let transport: Transporter | null | undefined;

function getTransport(): Transporter | null {
  if (transport !== undefined) return transport;
  const url = process.env.SMTP_URL;
  transport = url ? nodemailer.createTransport(url) : null;
  return transport;
}

export function mailConfigured() {
  return Boolean(process.env.SMTP_URL);
}

export async function sendMail(msg: { to: string; subject: string; text: string; html: string }) {
  const t = getTransport();
  const from = process.env.MAIL_FROM || "Pursuit <pursuit@localhost>";
  if (!t) {
    console.log(`[mail:dev] to=${msg.to} subject="${msg.subject}"\n${msg.text}\n`);
    return { delivered: false };
  }
  await t.sendMail({ from, ...msg });
  return { delivered: true };
}
