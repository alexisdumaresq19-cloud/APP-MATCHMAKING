"use server";

import { revalidatePath } from "next/cache";
import type { FeedbackOutcome } from "@prisma/client";
import { resolveParticipantAccess } from "@/lib/auth/participant-session";
import { isAppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { OUTCOMES } from "@/lib/feedback";
import { saveEventFeedback } from "@/server/services/feedback";
import { GENERIC_ERROR, type ActionState } from "./types";

const COMMENT_MAX = 500;

/** « Faire mon bilan » : one outcome per match, an optional comment (P2-S3). */
export async function submitEventFeedback(
  token: string,
  eventId: string,
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await resolveParticipantAccess(token);
  if (!context) return { ok: false, formError: "Votre lien n'est plus valide." };
  const entries: { matchId: string; outcome: FeedbackOutcome; comment: string | null }[] = [];
  const fieldErrors: Record<string, string[]> = {};
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("outcome-") || typeof value !== "string") continue;
    const matchId = key.slice("outcome-".length);
    if (!(OUTCOMES as readonly string[]).includes(value)) {
      fieldErrors[key] = ["Choisissez une réponse."];
      continue;
    }
    const rawComment = formData.get(`comment-${matchId}`);
    const comment = typeof rawComment === "string" ? rawComment.trim().slice(0, COMMENT_MAX) : "";
    entries.push({ matchId, outcome: value as FeedbackOutcome, comment: comment || null });
  }
  if (Object.keys(fieldErrors).length) {
    return { ok: false, fieldErrors, formError: "Veuillez corriger les champs indiqués." };
  }
  if (entries.length === 0) {
    return { ok: false, formError: "Répondez pour au moins un jumelage." };
  }
  try {
    const saved = await saveEventFeedback(
      context.organization.id,
      context.participant.id,
      eventId,
      entries,
    );
    revalidatePath(`/p/${token}/evenements/${eventId}`, "layout");
    return {
      ok: true,
      message: `Merci! ${saved} réponse${saved > 1 ? "s" : ""} enregistrée${saved > 1 ? "s" : ""}. Vous pouvez les modifier à tout moment.`,
    };
  } catch (error) {
    if (isAppError(error)) return { ok: false, formError: error.message };
    logger.error({ err: error }, "event feedback failed");
    return { ok: false, formError: GENERIC_ERROR };
  }
}
