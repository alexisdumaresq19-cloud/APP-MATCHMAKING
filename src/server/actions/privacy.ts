"use server";

import { revalidatePath } from "next/cache";
import { requireOrganizerAction } from "@/lib/auth/session";
import { isAppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { optionalText } from "@/lib/validation/common";
import { anonymizeParticipant, rejectDeletionRequest } from "@/server/services/privacy";
import { GENERIC_ERROR, type ActionState } from "./types";

function revalidate(participantId?: string) {
  revalidatePath("/admin/participants");
  revalidatePath("/admin/participants/suppressions");
  if (participantId) revalidatePath(`/admin/participants/${participantId}`);
  revalidatePath("/admin", "layout");
}

/** Irreversible: confirms by email, anonymizes the profile, closes pending requests (S4-05). */
export async function anonymize(participantId: string, note?: string): Promise<ActionState> {
  const { organizer, organization } = await requireOrganizerAction();
  const parsedNote = optionalText(500).safeParse(note ?? "");
  try {
    await anonymizeParticipant(organization.id, participantId, {
      organizerId: organizer.id,
      note: parsedNote.success ? parsedNote.data : null,
    });
    revalidate(participantId);
    return { ok: true, message: "Profil anonymisé et confirmation envoyée." };
  } catch (error) {
    if (isAppError(error)) return { ok: false, formError: error.message };
    logger.error({ err: error }, "anonymization failed");
    return { ok: false, formError: GENERIC_ERROR };
  }
}

export async function rejectDeletion(requestId: string, note: string): Promise<ActionState> {
  const { organizer, organization } = await requireOrganizerAction();
  const parsedNote = optionalText(500).safeParse(note);
  if (!parsedNote.success || !parsedNote.data) {
    return { ok: false, formError: "Indiquez le motif du refus (il sera conservé)." };
  }
  try {
    await rejectDeletionRequest(organization.id, requestId, {
      organizerId: organizer.id,
      note: parsedNote.data,
    });
    revalidate();
    return { ok: true, message: "Demande refusée; le motif est conservé." };
  } catch (error) {
    if (isAppError(error)) return { ok: false, formError: error.message };
    logger.error({ err: error }, "deletion rejection failed");
    return { ok: false, formError: GENERIC_ERROR };
  }
}
