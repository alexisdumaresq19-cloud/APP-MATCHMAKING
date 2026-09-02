import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { NotFoundError } from "@/lib/errors";

/**
 * Organization-scoped accessors (DECISIONS.md D-09).
 * Every organizer-facing read of an entity by id MUST go through one of these helpers so that
 * an organizer of organization A can never read or mutate data of organization B.
 */

export async function orgEvent<T extends Prisma.EventInclude | undefined = undefined>(
  organizationId: string,
  eventId: string,
  include?: T,
) {
  const event = await prisma.event.findFirst({
    where: { id: eventId, organizationId },
    include: include as T,
  });
  if (!event) throw new NotFoundError("Cet événement est introuvable.");
  return event as NonNullable<Prisma.Result<typeof prisma.event, { include: T }, "findFirst">>;
}

export async function orgParticipant(organizationId: string, participantId: string) {
  const participant = await prisma.participant.findFirst({
    where: { id: participantId, organizationId },
    include: { sector: true },
  });
  if (!participant) throw new NotFoundError("Ce participant est introuvable.");
  return participant;
}

export async function orgRegistration(organizationId: string, registrationId: string) {
  const registration = await prisma.eventRegistration.findFirst({
    where: { id: registrationId, event: { organizationId } },
    include: { participant: { include: { sector: true } }, event: true },
  });
  if (!registration) throw new NotFoundError("Cette inscription est introuvable.");
  return registration;
}

export async function orgSector(organizationId: string, sectorId: string) {
  const sector = await prisma.sector.findFirst({ where: { id: sectorId, organizationId } });
  if (!sector) throw new NotFoundError("Ce secteur est introuvable.");
  return sector;
}

export async function orgRuleSet(organizationId: string, ruleSetId: string) {
  const ruleSet = await prisma.matchingRuleSet.findFirst({
    where: { id: ruleSetId, organizationId },
  });
  if (!ruleSet) throw new NotFoundError("Ce jeu de règles est introuvable.");
  return ruleSet;
}

export async function orgOrganizer(organizationId: string, organizerId: string) {
  const organizer = await prisma.organizer.findFirst({
    where: { id: organizerId, organizationId },
  });
  if (!organizer) throw new NotFoundError("Ce compte est introuvable.");
  return organizer;
}

/** Where-clause fragment for registrations of an organization. */
export function registrationsOfOrg(organizationId: string): Prisma.EventRegistrationWhereInput {
  return { event: { organizationId } };
}
