"use server";

import { revalidatePath } from "next/cache";
import type { RegistrationStatus } from "@prisma/client";
import { audit } from "@/lib/audit";
import { requireOrganizerAction } from "@/lib/auth/session";
import { orgRegistration } from "@/lib/db/org-scope";
import { prisma } from "@/lib/db/prisma";
import { isAppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { fieldErrorsOf, formDataToObject, optionalText } from "@/lib/validation/common";
import { registrationStatusChangeSchema } from "@/lib/validation/event";
import { participantProfileSchema } from "@/lib/validation/registration";
import { currentConsentVersion, hasCurrentConsent } from "@/server/services/consent";
import { sendConsentPending, sendParticipantLink } from "@/server/services/participant-emails";
import { GENERIC_ERROR, type ActionState } from "./types";

const adminProfileSchema = participantProfileSchema.extend({ notes: optionalText(2000) });

function eventPaths(eventId: string): string[] {
  return [`/admin/events/${eventId}/inscrits`, `/admin/events/${eventId}`, "/admin"];
}

export async function updateRegistrantProfile(
  registrationId: string,
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { organizer, organization } = await requireOrganizerAction();
  const parsed = adminProfileSchema.safeParse(
    formDataToObject(formData, { arrays: ["offers", "needs"] }),
  );
  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: fieldErrorsOf(parsed.error),
      formError: "Veuillez corriger les champs indiqués.",
    };
  }
  const { notes, ...data } = parsed.data;
  try {
    const registration = await orgRegistration(organization.id, registrationId);
    const sector = await prisma.sector.findFirst({
      where: { id: data.sectorId, organizationId: organization.id },
    });
    if (!sector) return { ok: false, fieldErrors: { sectorId: ["Choisissez un secteur."] } };
    await prisma.$transaction([
      prisma.participant.update({
        where: { id: registration.participantId },
        data: {
          firstName: data.firstName,
          lastName: data.lastName,
          phone: data.phone,
          jobTitle: data.jobTitle,
          companyName: data.companyName,
          sectorId: sector.id,
          region: data.region,
          city: data.city,
          website: data.website,
          description: data.description,
          offers: data.offers,
          needs: data.needs,
        },
      }),
      prisma.eventRegistration.update({ where: { id: registration.id }, data: { notes } }),
    ]);
    await audit({
      organizationId: organization.id,
      actorType: "organizer",
      actorId: organizer.id,
      action: "UPDATE",
      entity: "Participant",
      entityId: registration.participantId,
      metadata: { registrationId, fields: Object.keys(data) },
    });
    for (const path of eventPaths(registration.eventId)) revalidatePath(path);
  } catch (error) {
    if (isAppError(error)) return { ok: false, formError: error.message };
    logger.error({ err: error }, "registrant update failed");
    return { ok: false, formError: GENERIC_ERROR };
  }
  return { ok: true, message: "Profil enregistré." };
}

export async function changeRegistrationStatus(
  registrationId: string,
  status: RegistrationStatus,
): Promise<ActionState> {
  const { organizer, organization } = await requireOrganizerAction();
  const parsed = registrationStatusChangeSchema.safeParse({ registrationId, status });
  if (!parsed.success) return { ok: false, formError: "Statut invalide." };
  try {
    const registration = await orgRegistration(organization.id, registrationId);
    const now = new Date();
    await prisma.eventRegistration.update({
      where: { id: registration.id },
      data: {
        status,
        cancelledAt: status === "CANCELLED" ? now : null,
        checkedInAt:
          status === "CHECKED_IN" ? (registration.checkedInAt ?? now) : registration.checkedInAt,
      },
    });
    await audit({
      organizationId: organization.id,
      actorType: "organizer",
      actorId: organizer.id,
      action: "STATUS_CHANGE",
      entity: "EventRegistration",
      entityId: registration.id,
      metadata: { from: registration.status, to: status },
    });
    for (const path of eventPaths(registration.eventId)) revalidatePath(path);
  } catch (error) {
    if (isAppError(error)) return { ok: false, formError: error.message };
    logger.error({ err: error }, "registration status change failed");
    return { ok: false, formError: GENERIC_ERROR };
  }
  return { ok: true, message: "Statut mis à jour." };
}

/** Re-sends the participant's personal link (or the consent request if consent is missing). */
export async function resendParticipantLink(registrationId: string): Promise<ActionState> {
  const { organizer, organization } = await requireOrganizerAction();
  try {
    const registration = await orgRegistration(organization.id, registrationId);
    if (registration.participant.deletedAt)
      return { ok: false, formError: "Ce participant a été supprimé." };
    const consented = await hasCurrentConsent(
      registration.participantId,
      currentConsentVersion(organization),
    );
    const sent = consented
      ? await sendParticipantLink({ organization, participant: registration.participant })
      : await sendConsentPending({
          organization,
          event: registration.event,
          participant: registration.participant,
        });
    if (!sent)
      return {
        ok: false,
        formError: "L'envoi du courriel a échoué. Vérifiez la configuration des courriels.",
      };
    await audit({
      organizationId: organization.id,
      actorType: "organizer",
      actorId: organizer.id,
      action: "UPDATE",
      entity: "Participant",
      entityId: registration.participantId,
      metadata: { action: consented ? "resend_link" : "resend_consent", registrationId },
    });
  } catch (error) {
    if (isAppError(error)) return { ok: false, formError: error.message };
    logger.error({ err: error }, "resend link failed");
    return { ok: false, formError: GENERIC_ERROR };
  }
  return { ok: true, message: "Courriel envoyé." };
}
