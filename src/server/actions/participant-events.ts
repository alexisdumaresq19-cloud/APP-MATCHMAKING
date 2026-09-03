"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { audit } from "@/lib/audit";
import { resolveParticipantAccess } from "@/lib/auth/participant-session";
import { prisma } from "@/lib/db/prisma";
import { logger } from "@/lib/logger";
import { clientIpFromHeaders, rateLimit } from "@/lib/rate-limit";
import { fieldErrorsOf, formDataToObject } from "@/lib/validation/common";
import { quickRegistrationSchema } from "@/lib/validation/registration";
import { registerWithProfile } from "@/server/services/quick-registration";
import { GENERIC_ERROR, type ActionState } from "./types";

/** « M'inscrire avec mon profil » from the participant space (D-35). */
export async function registerFromSpace(
  token: string,
  eventId: string,
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await resolveParticipantAccess(token);
  if (!context) return { ok: false, formError: "Votre lien n'est plus valide." };
  const headerList = await headers();
  const ip = clientIpFromHeaders(headerList);
  const userAgent = headerList.get("user-agent")?.slice(0, 500) ?? null;
  const limit = await rateLimit(`quick-register:${ip}`, { limit: 20, windowSeconds: 3600 });
  if (!limit.ok)
    return { ok: false, formError: "Trop de tentatives. Veuillez réessayer plus tard." };

  const event = await prisma.event.findFirst({
    where: { id: eventId, organizationId: context.organization.id },
    include: { organization: true },
  });
  if (!event || event.status === "DRAFT") {
    return { ok: false, formError: "Cet événement est introuvable." };
  }
  const parsed = quickRegistrationSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsOf(parsed.error) };

  let result;
  try {
    result = await registerWithProfile({
      participant: context.participant,
      event,
      goalsText: parsed.data.goalsText ?? null,
      consentAccepted: parsed.data.consent,
      ip,
      userAgent,
    });
  } catch (error) {
    logger.error({ err: error }, "registration from the participant space failed");
    return { ok: false, formError: GENERIC_ERROR };
  }
  if (!result.ok) {
    if (result.reason === "consent_required") {
      return {
        ok: false,
        fieldErrors: { consent: ["Vous devez lire et accepter l'avis de confidentialité."] },
      };
    }
    return { ok: false, formError: "Les inscriptions à cet événement sont fermées." };
  }
  revalidatePath(`/p/${token}`, "layout");
  redirect(`/p/${token}/evenements/${eventId}`);
}

/** « Afficher mon entreprise dans l'annuaire public » (Phase 2, D-36). */
export async function setDirectoryOptIn(token: string, optIn: boolean): Promise<ActionState> {
  const context = await resolveParticipantAccess(token);
  if (!context) return { ok: false, formError: "Votre lien n'est plus valide." };
  try {
    await prisma.participant.update({
      where: { id: context.participant.id },
      data: { directoryOptIn: optIn, directoryOptInAt: optIn ? new Date() : null },
    });
    await audit({
      organizationId: context.organization.id,
      actorType: "participant",
      actorId: context.participant.id,
      action: "UPDATE",
      entity: "Participant",
      entityId: context.participant.id,
      metadata: { directoryOptIn: optIn },
    });
    revalidatePath(`/p/${token}`, "layout");
    revalidatePath(`/${context.organization.slug}/entreprises`, "layout");
    return {
      ok: true,
      message: optIn
        ? "Votre entreprise apparaît maintenant dans l'annuaire public."
        : "Votre entreprise n'apparaît plus dans l'annuaire public.",
    };
  } catch (error) {
    logger.error({ err: error }, "directory opt-in update failed");
    return { ok: false, formError: GENERIC_ERROR };
  }
}

/** « Ne plus recevoir d'invitations » / « Recevoir à nouveau les invitations ». */
export async function setInvitationsOptOut(token: string, optOut: boolean): Promise<ActionState> {
  const context = await resolveParticipantAccess(token);
  if (!context) return { ok: false, formError: "Votre lien n'est plus valide." };
  try {
    await prisma.participant.update({
      where: { id: context.participant.id },
      data: { invitationsOptOut: optOut },
    });
    await audit({
      organizationId: context.organization.id,
      actorType: "participant",
      actorId: context.participant.id,
      action: "UPDATE",
      entity: "Participant",
      entityId: context.participant.id,
      metadata: { invitationsOptOut: optOut },
    });
    revalidatePath(`/p/${token}`, "layout");
    return {
      ok: true,
      message: optOut
        ? "C'est noté : vous ne recevrez plus d'invitations par courriel."
        : "Vous recevrez de nouveau les invitations aux prochains événements.",
    };
  } catch (error) {
    logger.error({ err: error }, "invitation preference update failed");
    return { ok: false, formError: GENERIC_ERROR };
  }
}
