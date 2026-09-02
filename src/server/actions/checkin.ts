"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { requireOrganizerAction } from "@/lib/auth/session";
import { orgEvent, orgRegistration } from "@/lib/db/org-scope";
import { prisma } from "@/lib/db/prisma";
import { isAppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import {
  emailSchema,
  fieldErrorsOf,
  formDataToObject,
  nameSchema,
  optionalText,
} from "@/lib/validation/common";
import { completeEvent as completeEventService } from "@/server/services/billing";
import { GENERIC_ERROR, type ActionState } from "./types";

function pathsOf(eventId: string): string[] {
  return [
    `/admin/events/${eventId}/jour-j`,
    `/admin/events/${eventId}/jour-j/plein-ecran`,
    `/admin/events/${eventId}/inscrits`,
    `/admin/events/${eventId}`,
    "/admin",
  ];
}

/** « Présent » : marks the arrival (idempotent). */
export async function checkIn(registrationId: string): Promise<ActionState> {
  const { organizer, organization } = await requireOrganizerAction();
  try {
    const registration = await orgRegistration(organization.id, registrationId);
    if (registration.status === "CANCELLED")
      return { ok: false, formError: "Cette inscription est annulée." };
    if (registration.status !== "CHECKED_IN") {
      await prisma.eventRegistration.update({
        where: { id: registration.id },
        data: { status: "CHECKED_IN", checkedInAt: registration.checkedInAt ?? new Date() },
      });
      await audit({
        organizationId: organization.id,
        actorType: "organizer",
        actorId: organizer.id,
        action: "CHECK_IN",
        entity: "EventRegistration",
        entityId: registration.id,
        metadata: { from: registration.status },
      });
    }
    for (const path of pathsOf(registration.eventId)) revalidatePath(path);
    return { ok: true, message: "Présence enregistrée." };
  } catch (error) {
    if (isAppError(error)) return { ok: false, formError: error.message };
    logger.error({ err: error }, "check-in failed");
    return { ok: false, formError: GENERIC_ERROR };
  }
}

/** Undo a check-in made by mistake: back to CONFIRMED. */
export async function undoCheckIn(registrationId: string): Promise<ActionState> {
  const { organizer, organization } = await requireOrganizerAction();
  try {
    const registration = await orgRegistration(organization.id, registrationId);
    if (registration.status !== "CHECKED_IN") return { ok: true, message: "Rien à annuler." };
    await prisma.eventRegistration.update({
      where: { id: registration.id },
      data: { status: "CONFIRMED", checkedInAt: null },
    });
    await audit({
      organizationId: organization.id,
      actorType: "organizer",
      actorId: organizer.id,
      action: "STATUS_CHANGE",
      entity: "EventRegistration",
      entityId: registration.id,
      metadata: { from: "CHECKED_IN", to: "CONFIRMED" },
    });
    for (const path of pathsOf(registration.eventId)) revalidatePath(path);
    return { ok: true, message: "Présence annulée." };
  } catch (error) {
    if (isAppError(error)) return { ok: false, formError: error.message };
    logger.error({ err: error }, "check-in undo failed");
    return { ok: false, formError: GENERIC_ERROR };
  }
}

const quickAddSchema = z.object({
  firstName: nameSchema,
  lastName: nameSchema,
  email: emailSchema,
  companyName: z
    .string({ error: "Entrez le nom de l'entreprise." })
    .trim()
    .min(1, "Entrez le nom de l'entreprise.")
    .max(120, "120 caractères maximum."),
  sectorId: optionalText(64),
});

/**
 * Walk-in at the door: creates (or reuses) the participant, registers them as MANUAL and marks
 * them present in one go. Consent is requested by email afterwards, like any manual entry.
 */
export async function quickAddCheckedIn(
  eventId: string,
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { organizer, organization } = await requireOrganizerAction();
  const parsed = quickAddSchema.safeParse(formDataToObject(formData));
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
    const sector = data.sectorId
      ? await prisma.sector.findFirst({
          where: { id: data.sectorId, organizationId: organization.id },
        })
      : null;
    const existing = await prisma.participant.findUnique({
      where: { organizationId_email: { organizationId: organization.id, email: data.email } },
    });
    const participant =
      existing && !existing.deletedAt
        ? existing
        : await prisma.participant.create({
            data: {
              organizationId: organization.id,
              email: data.email,
              firstName: data.firstName,
              lastName: data.lastName,
              companyName: data.companyName,
              sectorId: sector?.id ?? null,
              offers: [],
              needs: [],
            },
          });
    const registration = await prisma.eventRegistration.upsert({
      where: { eventId_participantId: { eventId: event.id, participantId: participant.id } },
      create: {
        eventId: event.id,
        participantId: participant.id,
        source: "MANUAL",
        status: "CHECKED_IN",
        checkedInAt: new Date(),
        offersSnapshot: participant.offers,
        needsSnapshot: participant.needs,
        soughtSectorsSnapshot: participant.soughtSectorIds,
      },
      update: { status: "CHECKED_IN", checkedInAt: new Date(), cancelledAt: null },
    });
    await audit({
      organizationId: organization.id,
      actorType: "organizer",
      actorId: organizer.id,
      action: "CHECK_IN",
      entity: "EventRegistration",
      entityId: registration.id,
      metadata: { walkIn: true, participantId: participant.id },
    });
    for (const path of pathsOf(event.id)) revalidatePath(path);
    return {
      ok: true,
      message: `${participant.firstName} ${participant.lastName} est inscrit et présent.`,
    };
  } catch (error) {
    if (isAppError(error)) return { ok: false, formError: error.message };
    logger.error({ err: error }, "walk-in failed");
    return { ok: false, formError: GENERIC_ERROR };
  }
}

/** « Terminer l'événement » (confirmed in the UI): NO_SHOW, COMPLETED and the billing snapshot. */
export async function completeEvent(eventId: string): Promise<ActionState> {
  const { organizer, organization } = await requireOrganizerAction();
  try {
    const result = await completeEventService(eventId, organization.id, {
      actorType: "organizer",
      actorId: organizer.id,
    });
    for (const path of pathsOf(eventId)) revalidatePath(path);
    revalidatePath("/admin", "layout");
    return {
      ok: true,
      message: `Événement terminé : ${result.snapshot.totalCheckedIn} présent${result.snapshot.totalCheckedIn > 1 ? "s" : ""}, ${result.noShows} absent${result.noShows > 1 ? "s" : ""}. Relevé de facturation enregistré.`,
    };
  } catch (error) {
    if (isAppError(error)) return { ok: false, formError: error.message };
    logger.error({ err: error }, "event completion failed");
    return { ok: false, formError: GENERIC_ERROR };
  }
}
