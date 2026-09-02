"use server";

import { revalidatePath } from "next/cache";
import { requireOrganizerAction } from "@/lib/auth/session";
import { isAppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { startInvitations } from "@/server/services/invitations";
import {
  runEmailBatch,
  startPublication,
  startReminder,
  type BatchProgress,
  type EmailBatchKind,
} from "@/server/services/publication";
import { GENERIC_ERROR, type ActionState } from "./types";

export type BatchState = ({ ok: true } & BatchProgress) | { ok: false; formError: string };

function pathsOf(eventId: string): string[] {
  return [`/admin/events/${eventId}/publication`, `/admin/events/${eventId}`, "/admin"];
}

/** Step 1 of « Publier les jumelages » : status → PUBLISHED. Emails follow with `sendBatch`. */
export async function publishMatches(eventId: string): Promise<ActionState> {
  const { organizer, organization } = await requireOrganizerAction();
  try {
    await startPublication(eventId, organization.id, {
      actorType: "organizer",
      actorId: organizer.id,
    });
    for (const path of pathsOf(eventId)) revalidatePath(path);
    return { ok: true, message: "Jumelages publiés. Envoi des courriels en cours…" };
  } catch (error) {
    if (isAppError(error)) return { ok: false, formError: error.message };
    logger.error({ err: error }, "publication failed");
    return { ok: false, formError: GENERIC_ERROR };
  }
}

/** Step 1 of « Envoyer un rappel ». */
export async function startReminderRun(eventId: string): Promise<ActionState> {
  const { organizer, organization } = await requireOrganizerAction();
  try {
    await startReminder(eventId, organization.id, {
      actorType: "organizer",
      actorId: organizer.id,
    });
    for (const path of pathsOf(eventId)) revalidatePath(path);
    return { ok: true, message: "Envoi du rappel en cours…" };
  } catch (error) {
    if (isAppError(error)) return { ok: false, formError: error.message };
    logger.error({ err: error }, "reminder start failed");
    return { ok: false, formError: GENERIC_ERROR };
  }
}

/** Step 1 of « Inviter les participants passés » (S5-03). */
export async function startInvitationRun(eventId: string): Promise<ActionState> {
  const { organizer, organization } = await requireOrganizerAction();
  try {
    await startInvitations(eventId, organization.id, {
      actorType: "organizer",
      actorId: organizer.id,
    });
    for (const path of pathsOf(eventId)) revalidatePath(path);
    return { ok: true, message: "Envoi des invitations en cours…" };
  } catch (error) {
    if (isAppError(error)) return { ok: false, formError: error.message };
    logger.error({ err: error }, "invitation start failed");
    return { ok: false, formError: GENERIC_ERROR };
  }
}

/** Sends the next batch (20 emails) of the given kind; the client calls it until remaining = 0. */
export async function sendBatch(eventId: string, kind: EmailBatchKind): Promise<BatchState> {
  const { organization } = await requireOrganizerAction();
  if (!["publish", "reminder", "consent", "invite"].includes(kind)) {
    return { ok: false, formError: "Type d'envoi inconnu." };
  }
  try {
    const progress = await runEmailBatch(eventId, organization.id, kind);
    if (progress.remaining === 0) for (const path of pathsOf(eventId)) revalidatePath(path);
    return { ok: true, ...progress };
  } catch (error) {
    if (isAppError(error)) return { ok: false, formError: error.message };
    logger.error({ err: error }, "email batch failed");
    return { ok: false, formError: GENERIC_ERROR };
  }
}
