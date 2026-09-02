"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { EventStatus, Prisma } from "@prisma/client";
import { audit } from "@/lib/audit";
import { requireOrganizerAction } from "@/lib/auth/session";
import { fromLocalInput } from "@/lib/dates";
import { orgEvent, orgRuleSet } from "@/lib/db/org-scope";
import { prisma } from "@/lib/db/prisma";
import { isAppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { slugify } from "@/lib/normalize";
import { fieldErrorsOf, formDataToObject, type FieldErrors } from "@/lib/validation/common";
import { eventSchema } from "@/lib/validation/event";
import { GENERIC_ERROR, type ActionState } from "./types";

function eventPath(id: string, tab = "details"): string {
  return `/admin/events/${id}/${tab}`;
}

async function uniqueSlug(
  organizationId: string,
  base: string,
  excludeId?: string,
): Promise<string> {
  let candidate = base || "evenement";
  for (let i = 2; i < 100; i += 1) {
    const clash = await prisma.event.findFirst({
      where: { organizationId, slug: candidate, ...(excludeId ? { id: { not: excludeId } } : {}) },
      select: { id: true },
    });
    if (!clash) return candidate;
    candidate = `${base}-${i}`;
  }
  return `${base}-${Date.now()}`;
}

/** Creates (eventId = null) or updates an event from the Details form. */
export async function saveEvent(
  eventId: string | null,
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { organizer, organization } = await requireOrganizerAction();
  const parsed = eventSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: fieldErrorsOf(parsed.error),
      formError: "Veuillez corriger les champs indiqués.",
    };
  }
  const data = parsed.data;
  const tz = organization.timezone;
  const fieldErrors: FieldErrors = {};

  const startsAt = fromLocalInput(data.startsAt, tz);
  const endsAt = data.endsAt ? fromLocalInput(data.endsAt, tz) : null;
  const registrationOpensAt = data.registrationOpensAt
    ? fromLocalInput(data.registrationOpensAt, tz)
    : null;
  const registrationClosesAt = data.registrationClosesAt
    ? fromLocalInput(data.registrationClosesAt, tz)
    : null;
  if (!startsAt) fieldErrors.startsAt = ["Entrez une date et une heure valides."];
  if (startsAt && endsAt && endsAt <= startsAt)
    fieldErrors.endsAt = ["La fin doit être après le début."];
  if (registrationOpensAt && registrationClosesAt && registrationClosesAt <= registrationOpensAt) {
    fieldErrors.registrationClosesAt = ["La fermeture doit être après l'ouverture."];
  }
  if (data.matchingRuleSetId) {
    try {
      await orgRuleSet(organization.id, data.matchingRuleSetId);
    } catch {
      fieldErrors.matchingRuleSetId = ["Ce jeu de règles est introuvable."];
    }
  }
  const slugClash = await prisma.event.findFirst({
    where: {
      organizationId: organization.id,
      slug: data.slug,
      ...(eventId ? { id: { not: eventId } } : {}),
    },
    select: { id: true },
  });
  if (slugClash) fieldErrors.slug = ["Ce lien est déjà utilisé par un autre événement."];
  if (Object.keys(fieldErrors).length)
    return { ok: false, fieldErrors, formError: "Veuillez corriger les champs indiqués." };

  const payload: Prisma.EventUncheckedCreateInput = {
    organizationId: organization.id,
    name: data.name,
    slug: data.slug,
    description: data.description,
    startsAt: startsAt!,
    endsAt,
    venueName: data.venueName,
    venueAddress: data.venueAddress,
    capacity: data.capacity ?? null,
    registrationOpensAt,
    registrationClosesAt,
    tableCount: data.tableCount,
    seatsPerTable: data.seatsPerTable,
    roundCount: data.roundCount,
    roundMinutes: data.roundMinutes ?? null,
    matchesPerParticipant: data.matchesPerParticipant,
    matchingRuleSetId: data.matchingRuleSetId ?? null,
  };

  let id = eventId;
  try {
    if (eventId) {
      await orgEvent(organization.id, eventId);
      const { organizationId: _ignored, ...updateData } = payload;
      await prisma.event.update({ where: { id: eventId }, data: updateData });
    } else {
      const created = await prisma.event.create({ data: payload });
      id = created.id;
    }
  } catch (error) {
    if (isAppError(error)) return { ok: false, formError: error.message };
    logger.error({ err: error }, "event save failed");
    return { ok: false, formError: GENERIC_ERROR };
  }

  await audit({
    organizationId: organization.id,
    actorType: "organizer",
    actorId: organizer.id,
    action: eventId ? "UPDATE" : "CREATE",
    entity: "Event",
    entityId: id,
    metadata: { name: data.name },
  });
  revalidatePath("/admin", "layout");
  if (!eventId) redirect(eventPath(id!));
  return { ok: true, message: "Événement enregistré." };
}

const TRANSITIONS: Record<string, { from: EventStatus[]; to: EventStatus }> = {
  open: { from: ["DRAFT", "CLOSED"], to: "OPEN" },
  close: { from: ["OPEN"], to: "CLOSED" },
  archive: {
    from: ["DRAFT", "OPEN", "CLOSED", "MATCHED", "PUBLISHED", "COMPLETED"],
    to: "ARCHIVED",
  },
  unarchive: { from: ["ARCHIVED"], to: "DRAFT" },
};

export async function changeEventStatus(
  eventId: string,
  transition: keyof typeof TRANSITIONS,
): Promise<ActionState> {
  const { organizer, organization } = await requireOrganizerAction();
  const rule = TRANSITIONS[transition];
  if (!rule) return { ok: false, formError: "Action inconnue." };
  try {
    const event = await orgEvent(organization.id, eventId);
    if (!rule.from.includes(event.status)) {
      return {
        ok: false,
        formError: "Cette action n'est pas possible dans l'état actuel de l'événement.",
      };
    }
    await prisma.event.update({ where: { id: eventId }, data: { status: rule.to } });
    await audit({
      organizationId: organization.id,
      actorType: "organizer",
      actorId: organizer.id,
      action: "STATUS_CHANGE",
      entity: "Event",
      entityId: eventId,
      metadata: { from: event.status, to: rule.to },
    });
  } catch (error) {
    if (isAppError(error)) return { ok: false, formError: error.message };
    logger.error({ err: error }, "event status change failed");
    return { ok: false, formError: GENERIC_ERROR };
  }
  revalidatePath("/admin", "layout");
  return { ok: true, message: "Statut mis à jour." };
}

/** Copies the configuration (never the registrations) into a new DRAFT event. */
export async function duplicateEvent(eventId: string): Promise<ActionState> {
  const { organizer, organization } = await requireOrganizerAction();
  let newId: string;
  try {
    const source = await orgEvent(organization.id, eventId);
    const slug = await uniqueSlug(organization.id, `${slugify(source.slug)}-copie`);
    const created = await prisma.event.create({
      data: {
        organizationId: organization.id,
        name: `Copie de ${source.name}`.slice(0, 120),
        slug,
        description: source.description,
        startsAt: source.startsAt,
        endsAt: source.endsAt,
        venueName: source.venueName,
        venueAddress: source.venueAddress,
        capacity: source.capacity,
        registrationOpensAt: source.registrationOpensAt,
        registrationClosesAt: source.registrationClosesAt,
        tableCount: source.tableCount,
        seatsPerTable: source.seatsPerTable,
        roundCount: source.roundCount,
        roundMinutes: source.roundMinutes,
        matchesPerParticipant: source.matchesPerParticipant,
        matchingRuleSetId: source.matchingRuleSetId,
        status: "DRAFT",
      },
    });
    newId = created.id;
    await audit({
      organizationId: organization.id,
      actorType: "organizer",
      actorId: organizer.id,
      action: "CREATE",
      entity: "Event",
      entityId: newId,
      metadata: { duplicatedFrom: eventId },
    });
  } catch (error) {
    if (isAppError(error)) return { ok: false, formError: error.message };
    logger.error({ err: error }, "event duplication failed");
    return { ok: false, formError: GENERIC_ERROR };
  }
  revalidatePath("/admin", "layout");
  redirect(eventPath(newId));
}
