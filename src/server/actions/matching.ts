"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { audit } from "@/lib/audit";
import { requireOrganizerAction } from "@/lib/auth/session";
import { orgEvent } from "@/lib/db/org-scope";
import { prisma } from "@/lib/db/prisma";
import { isAppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { orderPair } from "@/lib/matching";
import { cuidSchema } from "@/lib/validation/common";
import { matchStatusSchema } from "@/lib/validation/matching";
import { runMatchingForEvent, scorePairForEvent } from "@/server/services/matching";
import { GENERIC_ERROR, type ActionState } from "./types";

function revalidate(eventId: string) {
  revalidatePath(`/admin/events/${eventId}/matching`);
  revalidatePath(`/admin/events/${eventId}/inscrits`);
  revalidatePath("/admin");
}

export type RunMatchingState = ActionState & {
  summary?: {
    totalMatches: number;
    averageScore: number;
    eligible: number;
    ignored: number;
    fewMatches: number;
  };
};

export async function runMatching(eventId: string): Promise<RunMatchingState> {
  const { organizer, organization } = await requireOrganizerAction();
  try {
    await orgEvent(organization.id, eventId);
    const result = await runMatchingForEvent(eventId, organization.id, {
      actorType: "organizer",
      actorId: organizer.id,
    });
    revalidate(eventId);
    return {
      ok: true,
      message: `${result.summary.totalMatches} jumelages calculés (score moyen ${result.summary.averageScore}).`,
      summary: {
        totalMatches: result.summary.totalMatches,
        averageScore: result.summary.averageScore,
        eligible: result.summary.eligible,
        ignored: result.ignored.length,
        fewMatches: result.summary.withFewerThanTwo.length,
      },
    };
  } catch (error) {
    if (isAppError(error)) return { ok: false, formError: error.message };
    logger.error({ err: error }, "matching run failed");
    return { ok: false, formError: GENERIC_ERROR };
  }
}

/**
 * Pins, excludes or resets a pair. Missing pairs are created with the current rules' score;
 * resetting an EXCLUDED pair deletes it (the next run may propose it again), resetting a PINNED
 * pair turns it back into a plain proposal.
 */
export async function setMatchStatus(
  eventId: string,
  firstRegistrationId: string,
  secondRegistrationId: string,
  status: "PINNED" | "EXCLUDED" | "PROPOSED",
): Promise<ActionState> {
  const { organizer, organization } = await requireOrganizerAction();
  const parsedStatus = matchStatusSchema.safeParse(status);
  const parsedIds =
    cuidSchema.safeParse(firstRegistrationId) && cuidSchema.safeParse(secondRegistrationId);
  if (!parsedStatus.success || !parsedIds || firstRegistrationId === secondRegistrationId) {
    return { ok: false, formError: "Paire invalide." };
  }
  try {
    await orgEvent(organization.id, eventId);
    const [aId, bId] = orderPair(firstRegistrationId, secondRegistrationId);
    const registrations = await prisma.eventRegistration.count({
      where: { id: { in: [aId, bId] }, eventId },
    });
    if (registrations !== 2)
      return { ok: false, formError: "Ces inscriptions n'appartiennent pas à cet événement." };

    const existing = await prisma.match.findUnique({
      where: { eventId_aId_bId: { eventId, aId, bId } },
    });
    if (status === "PROPOSED") {
      if (existing?.status === "EXCLUDED")
        await prisma.match.delete({ where: { id: existing.id } });
      else if (existing)
        await prisma.match.update({ where: { id: existing.id }, data: { status: "PROPOSED" } });
    } else if (existing) {
      await prisma.match.update({ where: { id: existing.id }, data: { status } });
    } else {
      const pair = await scorePairForEvent(eventId, organization.id, aId, bId);
      await prisma.match.create({
        data: {
          eventId,
          aId,
          bId,
          status,
          score: pair?.score ?? 0,
          reasons: (pair?.reasons ?? {
            complementarity: { score: 0, aOffersBNeeds: [], bOffersANeeds: [] },
            sectorAffinity: { score: 50, sectors: [null, null] },
            region: { score: 50, same: false, neighbors: false, region: null },
            novelty: { score: 100, previouslyMet: false },
            penalties: [],
          }) as unknown as Prisma.InputJsonValue,
        },
      });
    }
    await audit({
      organizationId: organization.id,
      actorType: "organizer",
      actorId: organizer.id,
      action: "UPDATE",
      entity: "Match",
      entityId: `${aId}|${bId}`,
      metadata: { eventId, status },
    });
  } catch (error) {
    if (isAppError(error)) return { ok: false, formError: error.message };
    logger.error({ err: error }, "match status change failed");
    return { ok: false, formError: GENERIC_ERROR };
  }
  revalidate(eventId);
  const messages = {
    PINNED: "Jumelage épinglé.",
    EXCLUDED: "Paire exclue.",
    PROPOSED: "Statut réinitialisé.",
  };
  return { ok: true, message: messages[status] };
}
