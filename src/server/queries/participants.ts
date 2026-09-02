import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { describeMatch, type MatchReasons } from "@/lib/matching";
import type { ParticipantsQuery } from "@/lib/validation/organization";

export const PARTICIPANTS_PAGE_SIZE = 25;

export type DirectoryRow = {
  id: string;
  name: string;
  email: string;
  company: string;
  sector: string | null;
  region: string | null;
  registrations: number;
  lastEvent: { name: string; startsAt: Date } | null;
  consented: boolean;
  deletedAt: Date | null;
  pendingDeletion: boolean;
};

/** The directory (S4-06): search by name, company or email, filter by sector, paginated. */
export async function listDirectory(
  organizationId: string,
  consentVersion: string,
  query: ParticipantsQuery,
): Promise<{ rows: DirectoryRow[]; total: number; pageCount: number }> {
  const where: Prisma.ParticipantWhereInput = { organizationId };
  if (query.q) {
    where.OR = [
      { firstName: { contains: query.q, mode: "insensitive" } },
      { lastName: { contains: query.q, mode: "insensitive" } },
      { companyName: { contains: query.q, mode: "insensitive" } },
      { email: { contains: query.q, mode: "insensitive" } },
    ];
  }
  if (query.secteur) where.sectorId = query.secteur;
  const [participants, total] = await Promise.all([
    prisma.participant.findMany({
      where,
      include: {
        sector: true,
        registrations: {
          where: { status: { not: "CANCELLED" } },
          include: { event: { select: { name: true, startsAt: true } } },
          orderBy: { event: { startsAt: "desc" } },
        },
        consents: { where: { consentVersion }, select: { id: true }, take: 1 },
        deletionRequests: { where: { status: "PENDING" }, select: { id: true }, take: 1 },
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      skip: (query.page - 1) * PARTICIPANTS_PAGE_SIZE,
      take: PARTICIPANTS_PAGE_SIZE,
    }),
    prisma.participant.count({ where }),
  ]);
  return {
    rows: participants.map((p) => ({
      id: p.id,
      name: `${p.firstName} ${p.lastName}`,
      email: p.email,
      company: p.companyName,
      sector: p.sector?.name ?? null,
      region: p.region,
      registrations: p.registrations.length,
      lastEvent: p.registrations[0]?.event ?? null,
      consented: p.consents.length > 0,
      deletedAt: p.deletedAt,
      pendingDeletion: p.deletionRequests.length > 0,
    })),
    total,
    pageCount: Math.max(1, Math.ceil(total / PARTICIPANTS_PAGE_SIZE)),
  };
}

export type ParticipantProfile = Prisma.ParticipantGetPayload<{
  include: {
    sector: true;
    consents: true;
    deletionRequests: true;
    registrations: {
      include: {
        event: true;
        assignments: { include: { table: true } };
        matchesAsA: { include: { b: { include: { participant: true } } } };
        matchesAsB: { include: { a: { include: { participant: true } } } };
      };
    };
  };
}>;

export type ProfileMatch = {
  eventName: string;
  partner: string;
  company: string;
  score: number;
  status: string;
  sentences: string[];
};

export async function getParticipantProfile(
  organizationId: string,
  participantId: string,
): Promise<{
  participant: ParticipantProfile;
  matches: ProfileMatch[];
  soughtSectors: string[];
} | null> {
  const participant = await prisma.participant.findFirst({
    where: { id: participantId, organizationId },
    include: {
      sector: true,
      consents: { orderBy: { createdAt: "desc" } },
      deletionRequests: { orderBy: { requestedAt: "desc" } },
      registrations: {
        include: {
          event: true,
          assignments: { include: { table: true }, orderBy: { round: "asc" } },
          matchesAsA: { include: { b: { include: { participant: true } } } },
          matchesAsB: { include: { a: { include: { participant: true } } } },
        },
        orderBy: { event: { startsAt: "desc" } },
      },
    },
  });
  if (!participant) return null;
  const matches: ProfileMatch[] = participant.registrations.flatMap((registration) => [
    ...registration.matchesAsA.map((m) => ({
      eventName: registration.event.name,
      partner: `${m.b.participant.firstName} ${m.b.participant.lastName}`,
      company: m.b.participant.companyName,
      score: m.score,
      status: m.status,
      sentences: describeMatch(m.reasons as unknown as MatchReasons, "a"),
    })),
    ...registration.matchesAsB.map((m) => ({
      eventName: registration.event.name,
      partner: `${m.a.participant.firstName} ${m.a.participant.lastName}`,
      company: m.a.participant.companyName,
      score: m.score,
      status: m.status,
      sentences: describeMatch(m.reasons as unknown as MatchReasons, "b"),
    })),
  ]);
  const soughtSectors = participant.soughtSectorIds.length
    ? (
        await prisma.sector.findMany({
          where: { id: { in: participant.soughtSectorIds } },
          select: { name: true },
        })
      ).map((s) => s.name)
    : [];
  return { participant, matches, soughtSectors };
}

export type DeletionQueueRow = Prisma.DeletionRequestGetPayload<{
  include: {
    participant: {
      select: {
        id: true;
        firstName: true;
        lastName: true;
        email: true;
        companyName: true;
        deletedAt: true;
      };
    };
  };
}>;

export async function listDeletionRequests(organizationId: string): Promise<DeletionQueueRow[]> {
  return prisma.deletionRequest.findMany({
    where: { organizationId },
    include: {
      participant: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          companyName: true,
          deletedAt: true,
        },
      },
    },
    orderBy: [{ status: "asc" }, { requestedAt: "desc" }],
    take: 200,
  });
}

export async function countPendingDeletions(organizationId: string): Promise<number> {
  return prisma.deletionRequest.count({ where: { organizationId, status: "PENDING" } });
}

/** Read-only billing view (S4-04): the frozen snapshots with their events. */
export async function listBillingRows(organizationId: string) {
  const snapshots = await prisma.billingSnapshot.findMany({
    where: { organizationId },
    orderBy: { computedAt: "desc" },
  });
  const events = await prisma.event.findMany({
    where: { id: { in: snapshots.map((s) => s.eventId) } },
    select: { id: true, name: true, startsAt: true, slug: true },
  });
  const eventOf = new Map(events.map((e) => [e.id, e]));
  return snapshots.map((snapshot) => ({
    ...snapshot,
    event: eventOf.get(snapshot.eventId) ?? null,
  }));
}
