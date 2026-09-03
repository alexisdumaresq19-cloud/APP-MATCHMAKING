"use server";

import { revalidatePath } from "next/cache";
import { audit } from "@/lib/audit";
import { resolveParticipantAccess } from "@/lib/auth/participant-session";
import { logger } from "@/lib/logger";
import { keepProfile } from "@/server/services/retention";
import { GENERIC_ERROR, type ActionState } from "./types";

/** « Conserver mon profil » from the retention notice (P2-S3, D-39). */
export async function keepMyProfile(token: string): Promise<ActionState> {
  const context = await resolveParticipantAccess(token);
  if (!context) return { ok: false, formError: "Votre lien n'est plus valide." };
  try {
    await keepProfile(context.participant.id);
    await audit({
      organizationId: context.organization.id,
      actorType: "participant",
      actorId: context.participant.id,
      action: "UPDATE",
      entity: "Participant",
      entityId: context.participant.id,
      metadata: { retention: "kept" },
    });
    revalidatePath(`/p/${token}`, "layout");
    return { ok: true, message: "Votre profil est conservé. À bientôt!" };
  } catch (error) {
    logger.error({ err: error }, "keep profile failed");
    return { ok: false, formError: GENERIC_ERROR };
  }
}
