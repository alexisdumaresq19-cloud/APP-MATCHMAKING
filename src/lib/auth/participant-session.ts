import { cache } from "react";
import type { Organization, Participant, Sector } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import {
  participantAccessExpiry,
  signParticipantToken,
  verifyParticipantToken,
  type ParticipantTokenClaims,
} from "./participant-token";

export type ParticipantContext = {
  participant: Participant & { sector: Sector | null };
  organization: Organization;
  claims: ParticipantTokenClaims;
  token: string;
};

/**
 * Resolves a `/p/[token]` access token into a participant, checking signature, expiry,
 * `tokenVersion` (revocation) and logical deletion. Cached per request.
 */
export const resolveParticipantAccess = cache(
  async (token: string): Promise<ParticipantContext | null> => {
    const claims = await verifyParticipantToken(token);
    if (!claims || claims.purpose !== "access") return null;
    const participant = await prisma.participant.findFirst({
      where: { id: claims.participantId, organizationId: claims.organizationId, deletedAt: null },
      include: { sector: true, organization: true },
    });
    if (!participant || participant.tokenVersion !== claims.tokenVersion) return null;
    const { organization, ...rest } = participant;
    return { participant: rest, organization, claims, token };
  },
);

/** Resolves a one-click registration token (purpose "register") for a given event. */
export async function resolveRegisterToken(token: string, eventId: string) {
  const claims = await verifyParticipantToken(token);
  if (!claims || claims.purpose !== "register" || claims.eventId !== eventId) return null;
  const participant = await prisma.participant.findFirst({
    where: { id: claims.participantId, organizationId: claims.organizationId, deletedAt: null },
    include: { sector: true },
  });
  if (!participant || participant.tokenVersion !== claims.tokenVersion) return null;
  return participant;
}

/** Builds the absolute `/p/[token]` URL for a participant, valid until their last event + 30 days. */
export async function participantAccessUrl(
  participant: Pick<Participant, "id" | "organizationId" | "tokenVersion">,
): Promise<string> {
  const lastRegistration = await prisma.eventRegistration.findFirst({
    where: { participantId: participant.id, status: { not: "CANCELLED" } },
    orderBy: { event: { startsAt: "desc" } },
    include: { event: { select: { startsAt: true, endsAt: true } } },
  });
  const lastEventEnd = lastRegistration?.event.endsAt ?? lastRegistration?.event.startsAt ?? null;
  const token = await signParticipantToken(
    {
      participantId: participant.id,
      organizationId: participant.organizationId,
      tokenVersion: participant.tokenVersion,
      purpose: "access",
    },
    { expiresAt: participantAccessExpiry(lastEventEnd) },
  );
  return `${appBaseUrl()}/p/${token}`;
}

export function appBaseUrl(): string {
  return (process.env.APP_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
}
