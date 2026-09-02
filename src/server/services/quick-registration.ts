import type { Event, Organization, Participant, Sector } from "@prisma/client";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/db/prisma";
import { registrationAvailability } from "@/server/queries/public";
import { currentConsentVersion, hasCurrentConsent } from "./consent";
import { sendRegistrationConfirmed } from "./participant-emails";

export type RegisterWithProfileInput = {
  participant: Participant & { sector: Sector | null };
  event: Event & { organization: Organization };
  goalsText: string | null | undefined;
  consentAccepted: boolean;
  ip: string | null;
  userAgent: string | null;
};

export type RegisterWithProfileResult =
  { ok: true; alreadyRegistered: boolean } | { ok: false; reason: "closed" | "consent_required" };

/**
 * One-click registration with an existing profile: behind the emailed link (`inscription-rapide`),
 * the invitation email and « Autres événements ouverts » in the participant space. Reactivates a
 * cancelled registration, logs the consent when the current notice was not accepted yet, then
 * sends the confirmation email.
 */
export async function registerWithProfile(
  input: RegisterWithProfileInput,
): Promise<RegisterWithProfileResult> {
  const { participant, event } = input;
  const organization = event.organization;

  const existing = await prisma.eventRegistration.findUnique({
    where: { eventId_participantId: { eventId: event.id, participantId: participant.id } },
  });
  if (existing && existing.status !== "CANCELLED") return { ok: true, alreadyRegistered: true };

  const activeRegistrations = await prisma.eventRegistration.count({
    where: { eventId: event.id, status: { not: "CANCELLED" } },
  });
  if (!registrationAvailability({ ...event, activeRegistrations }).open) {
    return { ok: false, reason: "closed" };
  }

  const consentVersion = currentConsentVersion(organization);
  const needsConsent = !(await hasCurrentConsent(participant.id, consentVersion));
  if (needsConsent && !input.consentAccepted) return { ok: false, reason: "consent_required" };

  const snapshot = {
    offersSnapshot: participant.offers,
    needsSnapshot: participant.needs,
    soughtSectorsSnapshot: participant.soughtSectorIds,
    goalsText: input.goalsText ?? null,
  };
  await prisma.$transaction(async (tx) => {
    if (existing) {
      await tx.eventRegistration.update({
        where: { id: existing.id },
        data: { status: "REGISTERED", cancelledAt: null, ...snapshot },
      });
    } else {
      await tx.eventRegistration.create({
        data: { eventId: event.id, participantId: participant.id, source: "PLATFORM", ...snapshot },
      });
    }
    if (needsConsent) {
      await tx.consentLog.create({
        data: {
          participantId: participant.id,
          eventId: event.id,
          consentVersion,
          consentText: organization.consentText,
          ipAddress: input.ip,
          userAgent: input.userAgent,
        },
      });
      await tx.participant.update({
        where: { id: participant.id },
        data: { consentedAt: new Date() },
      });
    }
  });

  await audit({
    organizationId: organization.id,
    actorType: "participant",
    actorId: participant.id,
    action: "CREATE",
    entity: "EventRegistration",
    entityId: event.id,
    metadata: { eventId: event.id, source: "PLATFORM", quick: true },
  });
  const soughtSectors = participant.soughtSectorIds.length
    ? await prisma.sector.findMany({
        where: { id: { in: participant.soughtSectorIds } },
        select: { name: true },
      })
    : [];
  await sendRegistrationConfirmed({
    organization,
    event,
    participant,
    sectorName: participant.sector?.name ?? null,
    offers: participant.offers,
    needs: participant.needs,
    soughtSectorNames: soughtSectors.map((s) => s.name),
  });
  return { ok: true, alreadyRegistered: false };
}
