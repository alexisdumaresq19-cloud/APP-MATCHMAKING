"use server";

import { revalidatePath } from "next/cache";
import { requireOrganizerAction } from "@/lib/auth/session";
import { isAppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { applyAffinity } from "@/server/services/learning";
import { GENERIC_ERROR, type ActionState } from "./types";

/** « Appliquer » one suggestion from the surveys to the affinity matrix (P2-S3, D-38). */
export async function applyAffinitySuggestion(
  fromSectorId: string,
  toSectorId: string,
  score: number,
): Promise<ActionState> {
  const { organizer, organization } = await requireOrganizerAction();
  try {
    await applyAffinity(organization.id, fromSectorId, toSectorId, score, {
      organizerId: organizer.id,
    });
    revalidatePath("/admin/settings/affinites");
    return { ok: true, message: "Affinité mise à jour." };
  } catch (error) {
    if (isAppError(error)) return { ok: false, formError: error.message };
    logger.error({ err: error }, "affinity suggestion failed");
    return { ok: false, formError: GENERIC_ERROR };
  }
}
