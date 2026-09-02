import { cache } from "react";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { RegistrantsQuery } from "@/lib/validation/event";

export const PAGE_SIZE = 25;

export type EventFilter = "upcoming" | "past" | "all";

export const listEvents = cache(async (organizationId: string, filter: EventFilter = "all") => {
  const now = new Date();
  const where: Prisma.EventWhereInput = { organizationId };
  if (filter === "upcoming") where.startsAt = { gte: now };
  if (filter === "past") where.startsAt = { lt: now };
  return prisma.event.findMany({
    where,
    orderBy: { startsAt: filter === "past" ? "desc" : "asc" },
    include: {
      _count: { select: { registrations: { where: { status: { not: "CANCELLED" } } } } },
    },
  });
});

export const getRuleSets = cache(async (organizationId: string) =>
  prisma.matchingRuleSet.findMany({
    where: { organizationId },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    select: { id: true, name: true, isDefault: true },
  }),
);

export const getSectors = cache(async (organizationId: string) =>
  prisma.sector.findMany({
    where: { organizationId },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, isActive: true },
  }),
);

export type RegistrantRow = Prisma.EventRegistrationGetPayload<{
  include: {
    participant: { include: { sector: true } };
    _count: { select: { matchesAsA: true; matchesAsB: true } };
  };
}>;

export async function listRegistrants(eventId: string, query: RegistrantsQuery) {
  const where: Prisma.EventRegistrationWhereInput = { eventId };
  const participantWhere: Prisma.ParticipantWhereInput = {};
  if (query.q) {
    const q = query.q;
    participantWhere.OR = [
      { firstName: { contains: q, mode: "insensitive" } },
      { lastName: { contains: q, mode: "insensitive" } },
      { companyName: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
    ];
  }
  if (query.secteur) participantWhere.sectorId = query.secteur;
  if (query.region) participantWhere.region = query.region;
  if (Object.keys(participantWhere).length) where.participant = participantWhere;
  if (query.statut) where.status = query.statut;
  if (query.source) where.source = query.source;

  const direction = query.ordre;
  const orderBy: Prisma.EventRegistrationOrderByWithRelationInput[] =
    query.tri === "nom"
      ? [{ participant: { lastName: direction } }, { participant: { firstName: direction } }]
      : query.tri === "entreprise"
        ? [{ participant: { companyName: direction } }]
        : query.tri === "statut"
          ? [{ status: direction }, { createdAt: "desc" }]
          : [{ createdAt: direction }];

  const [rows, total, statusCounts] = await Promise.all([
    prisma.eventRegistration.findMany({
      where,
      orderBy,
      skip: (query.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        participant: { include: { sector: true } },
        _count: { select: { matchesAsA: true, matchesAsB: true } },
      },
    }),
    prisma.eventRegistration.count({ where }),
    prisma.eventRegistration.groupBy({
      by: ["status"],
      where: { eventId },
      _count: { _all: true },
    }),
  ]);
  return {
    rows,
    total,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    statusCounts: Object.fromEntries(statusCounts.map((s) => [s.status, s._count._all])) as Record<
      string,
      number
    >,
  };
}

export async function getDashboardData(organizationId: string) {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
  const [nextEvent, recentRegistrations, upcomingCount, missingSector, toMatch, toPublish] =
    await Promise.all([
      prisma.event.findFirst({
        where: { organizationId, startsAt: { gte: now }, status: { notIn: ["ARCHIVED"] } },
        orderBy: { startsAt: "asc" },
        include: {
          _count: { select: { registrations: { where: { status: { not: "CANCELLED" } } } } },
        },
      }),
      prisma.eventRegistration.count({
        where: {
          event: { organizationId },
          createdAt: { gte: sevenDaysAgo },
          status: { not: "CANCELLED" },
        },
      }),
      prisma.event.count({
        where: { organizationId, startsAt: { gte: now }, status: { notIn: ["ARCHIVED"] } },
      }),
      prisma.eventRegistration.count({
        where: {
          event: {
            organizationId,
            startsAt: { gte: now },
            status: { notIn: ["ARCHIVED", "COMPLETED"] },
          },
          status: { not: "CANCELLED" },
          participant: { sectorId: null },
        },
      }),
      prisma.event.findMany({
        where: { organizationId, status: "CLOSED", matchedAt: null },
        select: { id: true, name: true },
      }),
      prisma.event.findMany({
        where: { organizationId, status: "MATCHED", publishedAt: null },
        select: { id: true, name: true },
      }),
    ]);
  return { nextEvent, recentRegistrations, upcomingCount, missingSector, toMatch, toPublish };
}
