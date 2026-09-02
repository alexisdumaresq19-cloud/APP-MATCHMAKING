"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { audit } from "@/lib/audit";
import { signIn, signOut } from "@/lib/auth";
import { findLoginCandidate } from "@/lib/auth/organizer-login";
import {
  createOrganizerToken,
  consumeOrganizerToken,
  TOKEN_TTL_MINUTES,
} from "@/lib/auth/organizer-token";
import { appBaseUrl } from "@/lib/auth/participant-session";
import { hashPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/db/prisma";
import { emailBrandOf } from "@/lib/email/brand";
import { sendEmail } from "@/lib/email/send";
import { MagicLinkEmail } from "@/lib/email/templates/magic-link";
import { PasswordResetEmail } from "@/lib/email/templates/password-reset";
import { logger } from "@/lib/logger";
import { clientIpFromHeaders, rateLimit } from "@/lib/rate-limit";
import {
  loginSchema,
  magicLinkConsumeSchema,
  magicLinkRequestSchema,
  passwordResetRequestSchema,
  passwordResetSchema,
} from "@/lib/validation/auth";
import { acceptInvitationSchema } from "@/lib/validation/organization";
import { fieldErrorsOf, formDataToObject } from "@/lib/validation/common";
import { GENERIC_ERROR, type ActionState } from "./types";

const TOO_MANY = "Trop de tentatives. Veuillez patienter quelques minutes avant de réessayer.";

/** Only allow relative admin URLs as post-login destinations. */
function safeCallbackUrl(url: string | undefined): string {
  if (!url || !url.startsWith("/admin") || url.startsWith("//") || url.includes("\\"))
    return "/admin";
  if (url.startsWith("/admin/login") || url.startsWith("/admin/connexion")) return "/admin";
  return url;
}

async function clientIp(): Promise<string> {
  return clientIpFromHeaders(await headers());
}

export async function loginWithPassword(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = loginSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsOf(parsed.error) };
  const { email, password, callbackUrl } = parsed.data;

  const ip = await clientIp();
  const [byIp, byEmail] = await Promise.all([
    rateLimit(`login:ip:${ip}`, { limit: 30, windowSeconds: 15 * 60 }),
    rateLimit(`login:email:${email}`, { limit: 10, windowSeconds: 15 * 60 }),
  ]);
  if (!byIp.ok || !byEmail.ok) return { ok: false, formError: TOO_MANY };

  const candidate = await findLoginCandidate(email);
  if (candidate?.lockedUntil && candidate.lockedUntil > new Date()) {
    const minutes = Math.max(1, Math.ceil((candidate.lockedUntil.getTime() - Date.now()) / 60_000));
    return {
      ok: false,
      formError: `Compte temporairement verrouillé après plusieurs échecs. Réessayez dans ${minutes} minute${minutes > 1 ? "s" : ""} ou demandez un lien de connexion.`,
    };
  }

  try {
    await signIn("password", { email, password, redirect: false });
  } catch (error) {
    if (error instanceof AuthError) {
      return { ok: false, formError: "Courriel ou mot de passe incorrect." };
    }
    throw error;
  }
  redirect(safeCallbackUrl(callbackUrl));
}

export async function requestMagicLink(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = magicLinkRequestSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsOf(parsed.error) };
  const { email } = parsed.data;

  const ip = await clientIp();
  const [byIp, byEmail] = await Promise.all([
    rateLimit(`magic:ip:${ip}`, { limit: 10, windowSeconds: 15 * 60 }),
    rateLimit(`magic:email:${email}`, { limit: 3, windowSeconds: 15 * 60 }),
  ]);
  if (!byIp.ok || !byEmail.ok) return { ok: false, formError: TOO_MANY };

  const organizer = await findLoginCandidate(email);
  if (organizer) {
    const organization = await prisma.organization.findUniqueOrThrow({
      where: { id: organizer.organizationId },
    });
    const { token } = await createOrganizerToken(organizer, "MAGIC_LINK");
    const loginUrl = `${appBaseUrl()}/admin/connexion?token=${encodeURIComponent(token)}`;
    await sendEmail({
      organization,
      to: organizer.email,
      subject: "Votre lien de connexion",
      template: "magic_link",
      react: MagicLinkEmail({
        brand: emailBrandOf(organization),
        name: organizer.name,
        loginUrl,
        expiresMinutes: TOKEN_TTL_MINUTES.MAGIC_LINK,
      }),
    });
  } else {
    logger.info({ ip }, "magic link requested for unknown email");
  }
  return {
    ok: true,
    message:
      "Si un compte existe pour cette adresse, un lien de connexion vient d'être envoyé. Il est valide 15 minutes.",
  };
}

export async function loginWithMagicLink(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = magicLinkConsumeSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return { ok: false, formError: "Ce lien n'est plus valide." };
  const ip = await clientIp();
  const limit = await rateLimit(`magic-consume:ip:${ip}`, { limit: 20, windowSeconds: 15 * 60 });
  if (!limit.ok) return { ok: false, formError: TOO_MANY };

  try {
    await signIn("magic-link", { token: parsed.data.token, redirect: false });
  } catch (error) {
    if (error instanceof AuthError) {
      return {
        ok: false,
        formError: "Ce lien n'est plus valide. Demandez-en un nouveau depuis la page de connexion.",
      };
    }
    throw error;
  }
  redirect(safeCallbackUrl(parsed.data.callbackUrl));
}

export async function requestPasswordReset(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = passwordResetRequestSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsOf(parsed.error) };
  const { email } = parsed.data;

  const ip = await clientIp();
  const [byIp, byEmail] = await Promise.all([
    rateLimit(`reset:ip:${ip}`, { limit: 10, windowSeconds: 15 * 60 }),
    rateLimit(`reset:email:${email}`, { limit: 3, windowSeconds: 15 * 60 }),
  ]);
  if (!byIp.ok || !byEmail.ok) return { ok: false, formError: TOO_MANY };

  const organizer = await findLoginCandidate(email);
  if (organizer) {
    const organization = await prisma.organization.findUniqueOrThrow({
      where: { id: organizer.organizationId },
    });
    const { token } = await createOrganizerToken(organizer, "PASSWORD_RESET");
    const resetUrl = `${appBaseUrl()}/admin/reinitialiser?token=${encodeURIComponent(token)}`;
    await sendEmail({
      organization,
      to: organizer.email,
      subject: "Réinitialisation de votre mot de passe",
      template: "password_reset",
      react: PasswordResetEmail({
        brand: emailBrandOf(organization),
        name: organizer.name,
        resetUrl,
        expiresMinutes: TOKEN_TTL_MINUTES.PASSWORD_RESET,
      }),
    });
  }
  return {
    ok: true,
    message:
      "Si un compte existe pour cette adresse, un courriel de réinitialisation vient d'être envoyé.",
  };
}

export async function resetPassword(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = passwordResetSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsOf(parsed.error) };

  const ip = await clientIp();
  const limit = await rateLimit(`reset-consume:ip:${ip}`, { limit: 20, windowSeconds: 15 * 60 });
  if (!limit.ok) return { ok: false, formError: TOO_MANY };

  const organizer = await consumeOrganizerToken(parsed.data.token, "PASSWORD_RESET");
  if (!organizer) {
    return {
      ok: false,
      formError: "Ce lien n'est plus valide. Faites une nouvelle demande de réinitialisation.",
    };
  }
  try {
    await prisma.organizer.update({
      where: { id: organizer.id },
      data: {
        passwordHash: await hashPassword(parsed.data.password),
        sessionVersion: { increment: 1 }, // signs out every other session
        failedLoginCount: 0,
        lockedUntil: null,
      },
    });
  } catch (error) {
    logger.error({ err: error }, "password reset failed");
    return { ok: false, formError: GENERIC_ERROR };
  }
  await audit({
    organizationId: organizer.organizationId,
    actorType: "organizer",
    actorId: organizer.id,
    action: "UPDATE",
    entity: "Organizer",
    entityId: organizer.id,
    metadata: { change: "password_reset" },
  });
  redirect("/admin/login?raison=mot-de-passe-modifie");
}

export async function logout(): Promise<void> {
  await signOut({ redirectTo: "/admin/login" });
}

/** Invitation acceptance (S4-03): the invited organizer chooses a password and can log in. */
export async function acceptInvitation(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = acceptInvitationSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsOf(parsed.error) };

  const ip = await clientIp();
  const limit = await rateLimit(`invite-consume:ip:${ip}`, { limit: 20, windowSeconds: 15 * 60 });
  if (!limit.ok) return { ok: false, formError: TOO_MANY };

  const organizer = await consumeOrganizerToken(parsed.data.token, "INVITE");
  if (!organizer) {
    return {
      ok: false,
      formError: "Cette invitation n'est plus valide. Demandez-en une nouvelle à un propriétaire.",
    };
  }
  try {
    await prisma.organizer.update({
      where: { id: organizer.id },
      data: {
        passwordHash: await hashPassword(parsed.data.password),
        sessionVersion: { increment: 1 },
        failedLoginCount: 0,
        lockedUntil: null,
      },
    });
  } catch (error) {
    logger.error({ err: error }, "invitation acceptance failed");
    return { ok: false, formError: GENERIC_ERROR };
  }
  await audit({
    organizationId: organizer.organizationId,
    actorType: "organizer",
    actorId: organizer.id,
    action: "UPDATE",
    entity: "Organizer",
    entityId: organizer.id,
    metadata: { change: "invitation_accepted" },
  });
  redirect("/admin/login?raison=invitation-acceptee");
}
