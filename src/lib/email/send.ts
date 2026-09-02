import type { ReactElement } from "react";
import { render } from "@react-email/render";
import { prisma } from "@/lib/db/prisma";
import { logger } from "@/lib/logger";
import { sendRawEmail } from "./transport";

export type EmailTemplateName =
  | "registration_confirmed"
  | "existing_profile_link"
  | "matches_published"
  | "reminder"
  | "magic_link"
  | "password_reset"
  | "consent_pending"
  | "deletion_confirmed"
  | "organizer_invite"
  | "participant_link";

export type EmailOrganization = {
  name: string;
  platformName: string;
  replyToEmail: string;
};

export type SendEmailInput = {
  organization: EmailOrganization;
  to: string;
  subject: string;
  template: EmailTemplateName;
  react: ReactElement;
  eventId?: string | null;
};

function fromAddress(): string {
  const configured = process.env.EMAIL_FROM ?? "Jumelage <no-reply@localhost>";
  const match = /<([^>]+)>/.exec(configured);
  return match ? match[1] : configured.trim();
}

function displayFrom(organization: EmailOrganization): string {
  const label = `${organization.platformName} via ${organization.name}`.replace(/["<>]/g, "");
  return `"${label}" <${fromAddress()}>`;
}

/** Renders a react-email template, sends it, and records the outcome in EmailLog. */
export async function sendEmail(input: SendEmailInput): Promise<boolean> {
  const [html, text] = await Promise.all([
    render(input.react),
    render(input.react, { plainText: true }),
  ]);
  const result = await sendRawEmail({
    from: displayFrom(input.organization),
    to: input.to,
    replyTo: input.organization.replyToEmail,
    subject: input.subject,
    html,
    text,
  });
  try {
    await prisma.emailLog.create({
      data: {
        eventId: input.eventId ?? null,
        toEmail: input.to,
        template: input.template,
        providerId: result.ok ? result.providerId : null,
        status: result.ok ? "sent" : "failed",
        error: result.ok ? null : result.error.slice(0, 1000),
      },
    });
  } catch (error) {
    logger.error({ err: error }, "email log write failed");
  }
  return result.ok;
}
