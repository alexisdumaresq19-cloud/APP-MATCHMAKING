"use server";

import { revalidatePath } from "next/cache";
import type { RegistrationStatus } from "@prisma/client";
import { audit } from "@/lib/audit";
import { requireOrganizerAction } from "@/lib/auth/session";
import { orgEvent, orgRegistration } from "@/lib/db/org-scope";
import { prisma } from "@/lib/db/prisma";
import { isAppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import {
  checkboxSchema,
  emailSchema,
  fieldErrorsOf,
  formDataToObject,
  optionalText,
} from "@/lib/validation/common";
import { registrationStatusChangeSchema } from "@/lib/validation/event";
import { participantProfileSchema } from "@/lib/validation/registration";
import { currentConsentVersion, hasCurrentConsent } from "@/server/services/consent";
import {
  sendConsentPending,
  sendParticipantLink,
  sendRegistrationConfirmed,
} from "@/server/services/participant-emails";
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

const manualRegistrantSchema = participantProfileSchema.extend({
  email: emailSchema,
  goalsText: optionalText(500),
  notes: optionalText(2000),
  sendEmail: checkboxSchema,
});

/** Organizer adds a registrant by hand (source MANUAL). Existing participants keep their profile. */
export async function addRegistrantManually(
  eventId: string,
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { organizer, organization } = await requireOrganizerAction();
  const parsed = manualRegistrantSchema.safeParse(
    formDataToObject(formData, { arrays: ["offers", "needs"] }),
  );
  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: fieldErrorsOf(parsed.error),
      formError: "Veuillez corriger les champs indiqués.",
    };
  }
  const data = parsed.data;
  try {
    const event = await orgEvent(organization.id, eventId);
    const sector = await prisma.sector.findFirst({
      where: { id: data.sectorId, organizationId: organization.id },
    });
    if (!sector) return { ok: false, fieldErrors: { sectorId: ["Choisissez un secteur."] } };

    const existing = await prisma.participant.findUnique({
      where: { organizationId_email: { organizationId: organization.id, email: data.email } },
    });
    let participant = existing && !existing.deletedAt ? existing : null;
    let reusedProfile = false;
    if (participant) {
      reusedProfile = true;
    } else {
      participant = await prisma.participant.create({
        data: {
          organizationId: organization.id,
          email: data.email,
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
      });
    }

    const registration = await prisma.eventRegistration.findUnique({
      where: { eventId_participantId: { eventId: event.id, participantId: participant.id } },
    });
    if (registration && registration.status !== "CANCELLED") {
      return {
        ok: false,
        fieldErrors: { email: ["Cette personne est déjà inscrite à cet événement."] },
      };
    }
    if (registration) {
      await prisma.eventRegistration.update({
        where: { id: registration.id },
        data: {
          status: "REGISTERED",
          cancelledAt: null,
          source: "MANUAL",
          goalsText: data.goalsText,
          notes: data.notes,
        },
      });
    } else {
      await prisma.eventRegistration.create({
        data: {
          eventId: event.id,
          participantId: participant.id,
          source: "MANUAL",
          offersSnapshot: reusedProfile ? participant.offers : data.offers,
          needsSnapshot: reusedProfile ? participant.needs : data.needs,
          goalsText: data.goalsText,
          notes: data.notes,
        },
      });
    }
    await audit({
      organizationId: organization.id,
      actorType: "organizer",
      actorId: organizer.id,
      action: "CREATE",
      entity: "EventRegistration",
      entityId: event.id,
      metadata: { participantId: participant.id, source: "MANUAL", reusedProfile },
    });
    if (data.sendEmail) {
      const consented = await hasCurrentConsent(
        participant.id,
        currentConsentVersion(organization),
      );
      if (consented) {
        await sendRegistrationConfirmed({
          organization,
          event,
          participant,
          sectorName: sector.name,
          offers: participant.offers,
          needs: participant.needs,
        });
      } else {
        await sendConsentPending({ organization, event, participant });
      }
    }
    for (const path of eventPaths(event.id)) revalidatePath(path);
    return {
      ok: true,
      message: reusedProfile
        ? "Inscrit ajouté avec son profil existant."
        : "Inscrit ajouté. Consentement en attente.",
    };
  } catch (error) {
    if (isAppError(error)) return { ok: false, formError: error.message };
    logger.error({ err: error }, "manual registrant failed");
    return { ok: false, formError: GENERIC_ERROR };
  }
}
