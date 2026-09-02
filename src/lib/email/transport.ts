import nodemailer from "nodemailer";
import { Resend } from "resend";
import { logger } from "@/lib/logger";

export type EmailTransportKind = "resend" | "smtp" | "console";

export type RawEmail = {
  from: string;
  to: string;
  replyTo?: string;
  subject: string;
  html: string;
  text: string;
};

export type SendResult = { ok: true; providerId: string | null } | { ok: false; error: string };

export function resolveTransportKind(): EmailTransportKind {
  const forced = process.env.EMAIL_TRANSPORT;
  if (forced === "resend" || forced === "smtp" || forced === "console") return forced;
  if (process.env.RESEND_API_KEY) return "resend";
  if (process.env.SMTP_HOST) return "smtp";
  return "console";
}

let resendClient: Resend | undefined;
let smtpTransport: nodemailer.Transporter | undefined;

async function sendWithResend(email: RawEmail): Promise<SendResult> {
  resendClient ??= new Resend(process.env.RESEND_API_KEY);
  const { data, error } = await resendClient.emails.send({
    from: email.from,
    to: email.to,
    replyTo: email.replyTo,
    subject: email.subject,
    html: email.html,
    text: email.text,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, providerId: data?.id ?? null };
}

async function sendWithSmtp(email: RawEmail): Promise<SendResult> {
  const port = Number(process.env.SMTP_PORT ?? 587);
  smtpTransport ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });
  const info = await smtpTransport.sendMail({
    from: email.from,
    to: email.to,
    replyTo: email.replyTo,
    subject: email.subject,
    html: email.html,
    text: email.text,
  });
  return { ok: true, providerId: info.messageId ?? null };
}

async function sendWithConsole(email: RawEmail): Promise<SendResult> {
  logger.info(
    { to: email.to, subject: email.subject, from: email.from, text: email.text },
    "email (console transport — not sent)",
  );
  return { ok: true, providerId: "console" };
}

/** Sends one email through the configured transport. Never throws. */
export async function sendRawEmail(email: RawEmail): Promise<SendResult> {
  const kind = resolveTransportKind();
  try {
    switch (kind) {
      case "resend":
        return await sendWithResend(email);
      case "smtp":
        return await sendWithSmtp(email);
      default:
        return await sendWithConsole(email);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error({ err: error, transport: kind, to: email.to }, "email send failed");
    return { ok: false, error: message };
  }
}
