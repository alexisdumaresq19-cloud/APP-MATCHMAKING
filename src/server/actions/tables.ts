"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { requireOrganizerAction } from "@/lib/auth/session";
import { orgEvent } from "@/lib/db/org-scope";
import { prisma } from "@/lib/db/prisma";
import { isAppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import {
  cuidSchema,
  fieldErrorsOf,
  formDataToObject,
  optionalInt,
  optionalText,
  requiredInt,
} from "@/lib/validation/common";
import {
  clearSeating,
  ensureTables,
  moveSeat as moveSeatService,
  runSeatingForEvent,
  setSeatLock,
} from "@/server/services/seating";
import { GENERIC_ERROR, type ActionState } from "./types";

const setupSchema = z.object({
  tableCount: requiredInt(1, 200),
  seatsPerTable: requiredInt(2, 50),
  roundCount: requiredInt(1, 10),
  roundMinutes: optionalInt(5, 240),
});

function tablesPath(eventId: string): string {
  return `/admin/events/${eventId}/tables`;
}

/** Tables / seats / rounds and the optional label of each table (fields `label-<number>`). */
export async function saveTableSetup(
  eventId: string,
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { organizer, organization } = await requireOrganizerAction();
  const raw = formDataToObject(formData);
  const parsed = setupSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: fieldErrorsOf(parsed.error),
      formError: "Veuillez corriger les champs indiqués.",
    };
  }
  const data = parsed.data;
  try {
    await orgEvent(organization.id, eventId);
    const event = await prisma.event.update({
      where: { id: eventId },
      data: {
        tableCount: data.tableCount,
        seatsPerTable: data.seatsPerTable,
        roundCount: data.roundCount,
        roundMinutes: data.roundMinutes ?? null,
      },
    });
    const tables = await ensureTables(event);
    // Seats of rounds that no longer exist would dangle: drop them.
    await prisma.tableAssignment.deleteMany({
      where: { registration: { eventId }, round: { gt: data.roundCount } },
    });
    const labelSchema = optionalText(40);
    for (const table of tables) {
      const value = raw[`label-${table.number}`];
      if (typeof value !== "string") continue;
      const label = labelSchema.safeParse(value);
      if (!label.success) continue;
      if ((label.data ?? null) !== table.label) {
        await prisma.eventTable.update({ where: { id: table.id }, data: { label: label.data } });
      }
    }
    await audit({
      organizationId: organization.id,
      actorType: "organizer",
      actorId: organizer.id,
      action: "UPDATE",
      entity: "Event",
      entityId: eventId,
      metadata: { tables: data },
    });
  } catch (error) {
    if (isAppError(error)) return { ok: false, formError: error.message };
    logger.error({ err: error }, "table setup failed");
    return { ok: false, formError: GENERIC_ERROR };
  }
  revalidatePath(tablesPath(eventId));
  revalidatePath(`/admin/events/${eventId}`, "layout");
  return { ok: true, message: "Configuration des tables enregistrée." };
}

/** « Placer automatiquement » : recomputes every unlocked seat for every round. */
export async function autoSeat(eventId: string): Promise<ActionState> {
  const { organizer, organization } = await requireOrganizerAction();
  try {
    const result = await runSeatingForEvent(eventId, organization.id, {
      actorType: "organizer",
      actorId: organizer.id,
    });
    revalidatePath(tablesPath(eventId));
    const parts = [
      `${result.placed} place${result.placed > 1 ? "s" : ""} attribuée${result.placed > 1 ? "s" : ""}`,
    ];
    if (result.unplaced)
      parts.push(`${result.unplaced} sans place (ajoutez des tables ou des sièges)`);
    if (result.report.relaxedSameSector)
      parts.push("des personnes du même secteur ont dû partager une table");
    return { ok: true, message: `Placement terminé : ${parts.join(" · ")}.` };
  } catch (error) {
    if (isAppError(error)) return { ok: false, formError: error.message };
    logger.error({ err: error }, "auto seating failed");
    return { ok: false, formError: GENERIC_ERROR };
  }
}

const moveSchema = z.object({
  registrationId: cuidSchema,
  round: z.number().int().min(1).max(10),
  tableId: cuidSchema.nullable(),
});

/** Drag-and-drop or keyboard move; a manual move locks the seat. */
export async function moveSeat(
  eventId: string,
  input: { registrationId: string; round: number; tableId: string | null },
): Promise<ActionState> {
  const { organization } = await requireOrganizerAction();
  const parsed = moveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, formError: "Déplacement invalide." };
  try {
    await moveSeatService(
      eventId,
      organization.id,
      parsed.data.registrationId,
      parsed.data.round,
      parsed.data.tableId,
    );
    revalidatePath(tablesPath(eventId));
    return { ok: true, message: parsed.data.tableId ? "Place déplacée." : "Place libérée." };
  } catch (error) {
    if (isAppError(error)) return { ok: false, formError: error.message };
    logger.error({ err: error }, "seat move failed");
    return { ok: false, formError: GENERIC_ERROR };
  }
}

export async function toggleSeatLock(
  eventId: string,
  registrationId: string,
  round: number,
  isLocked: boolean,
): Promise<ActionState> {
  const { organization } = await requireOrganizerAction();
  try {
    await setSeatLock(eventId, organization.id, registrationId, round, isLocked);
    revalidatePath(tablesPath(eventId));
    return { ok: true, message: isLocked ? "Place verrouillée." : "Place déverrouillée." };
  } catch (error) {
    if (isAppError(error)) return { ok: false, formError: error.message };
    logger.error({ err: error }, "seat lock failed");
    return { ok: false, formError: GENERIC_ERROR };
  }
}

export async function clearRoundSeating(eventId: string, round: number): Promise<ActionState> {
  const { organizer, organization } = await requireOrganizerAction();
  try {
    const count = await clearSeating(eventId, organization.id, round);
    await audit({
      organizationId: organization.id,
      actorType: "organizer",
      actorId: organizer.id,
      action: "DELETE",
      entity: "TableAssignment",
      entityId: eventId,
      metadata: { round, count },
    });
    revalidatePath(tablesPath(eventId));
    return {
      ok: true,
      message: `${count} place${count > 1 ? "s" : ""} libérée${count > 1 ? "s" : ""}.`,
    };
  } catch (error) {
    if (isAppError(error)) return { ok: false, formError: error.message };
    logger.error({ err: error }, "seat clearing failed");
    return { ok: false, formError: GENERIC_ERROR };
  }
}
