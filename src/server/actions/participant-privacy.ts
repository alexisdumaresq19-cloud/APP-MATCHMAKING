"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { resolveParticipantAccess } from "@/lib/auth/participant-session";
import { logger } from "@/lib/logger";
import { clientIpFromHeaders, rateLimit } from "@/lib/rate-limit";
import { requestDeletion } from "@/server/services/privacy";
import { GENERIC_ERROR, type ActionState } from "./types";

/** « Demander la suppression de mes données » from the participant space (rate limited). */
export async function requestMyDeletion(token: string): Promise<ActionState> {
  const context = await resolveParticipantAccess(token);
  if (!context) return { ok: false, formError: "Votre lien n'est plus valide." };
  const ip = clientIpFromHeaders(await headers());
  const [byIp, byParticipant] = await Promise.all([
    rateLimit(`deletion:ip:${ip}`, { limit: 10, windowSeconds: 24 * 3600 }),
    rateLimit(`deletion:participant:${context.participant.id}`, {
      limit: 3,
      windowSeconds: 24 * 3600,
    }),
  ]);
  if (!byIp.ok || !byParticipant.ok) {
    return { ok: false, formError: "Trop de demandes. Réessayez demain ou écrivez-nous." };
  }
  try {
    await requestDeletion(context.participant, context.organization);
    revalidatePath(`/p/${token}/donnees`);
    return {
      ok: true,
      message:
        "Demande reçue. Le responsable de la protection des renseignements personnels a 30 jours pour la traiter; vous recevrez un courriel de confirmation.",
    };
  } catch (error) {
    logger.error({ err: error }, "participant deletion request failed");
    return { ok: false, formError: GENERIC_ERROR };
  }
}
