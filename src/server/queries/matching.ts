import type { MatchStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { describeMatch, type MatchReasons } from "@/lib/matching";
import {
  loadCandidates,
  loadRuleSetForEvent,
  type IgnoredRegistration,
} from "@/server/services/matching";

export const MATCHING_PAGE_SIZE = 20;

export type PersonSummary = {
  registrationId: string;
  name: string;
  company: string;
  sector: string | null;
  region: string | null;
};

export type MatchView = {
  matchId: string;
  partner: PersonSummary;
  score: number;
  status: MatchStatus;
  sentences: string[];
  isA: boolean;
};

export type RegistrantMatches = { person: PersonSummary; matches: MatchView[] };

export type MatchingOverview = {
  eligible: number;
  ignored: IgnoredRegistration[];
  lastRun: Date | null;
  ruleSetName: string;
  ruleSetId: string | null;
  totalMatches: number;
  averageScore: number;
  pinned: number;
  excluded: number;
  fewMatches: (PersonSummary & { count: number })[];
};

function summarize(registration: {
  id: string;
  participant: {
    firstName: string;
    lastName: string;
    companyName: string;
    region: string | null;
    sector: { name: string } | null;
  };
}): PersonSummary {
  return {
    registrationId: registration.id,
    name: `${registration.participant.firstName} ${registration.participant.lastName}`,
    company: registration.participant.companyName,
    sector: registration.participant.sector?.name ?? null,
    region: registration.participant.region,
  };
}

export async function getMatchingOverview(
  eventId: string,
  organizationId: string,
): Promise<MatchingOverview> {
  const event = await prisma.event.findFirstOrThrow({ where: { id: eventId, organizationId } });
  const [ruleSet, { candidates, ignored }, matches] = await Promise.all([
    loadRuleSetForEvent(event),
    loadCandidates(eventId, organizationId),
    prisma.match.findMany({
      where: { eventId },
      select: { aId: true, bId: true, score: true, status: true },
    }),
  ]);
  const active = matches.filter((m) => m.status !== "EXCLUDED");
  const counts = new Map<string, number>();
  for (const candidate of candidates) counts.set(candidate.registrationId, 0);
  for (const match of active) {
    counts.set(match.aId, (counts.get(match.aId) ?? 0) + 1);
    counts.set(match.bId, (counts.get(match.bId) ?? 0) + 1);
  }
  const fewIds = [...counts.entries()].filter(([, count]) => count < 2).map(([id]) => id);
  const fewRegistrations = fewIds.length
    ? await prisma.eventRegistration.findMany({
        where: { id: { in: fewIds } },
        include: { participant: { include: { sector: true } } },
      })
    : [];
  return {
    eligible: candidates.length,
    ignored,
    lastRun: event.matchedAt,
    ruleSetName: ruleSet?.name ?? "Règles par défaut",
    ruleSetId: ruleSet?.id ?? null,
    totalMatches: active.length,
    averageScore: active.length
      ? Math.round(active.reduce((sum, m) => sum + m.score, 0) / active.length)
      : 0,
    pinned: matches.filter((m) => m.status === "PINNED").length,
    excluded: matches.filter((m) => m.status === "EXCLUDED").length,
    fewMatches: event.matchedAt
      ? fewRegistrations.map((r) => ({ ...summarize(r), count: counts.get(r.id) ?? 0 }))
      : [],
  };
}

export async function listRegistrantsWithMatches(
  eventId: string,
  query: { q?: string; page: number },
): Promise<{ rows: RegistrantMatches[]; total: number; pageCount: number }> {
  const where = {
    eventId,
    status: { not: "CANCELLED" as const },
    participant: {
      deletedAt: null,
      ...(query.q
        ? {
            OR: [
              { firstName: { contains: query.q, mode: "insensitive" as const } },
              { lastName: { contains: query.q, mode: "insensitive" as const } },
              { companyName: { contains: query.q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
  };
  const [registrations, total] = await Promise.all([
    prisma.eventRegistration.findMany({
      where,
      include: { participant: { include: { sector: true } } },
      orderBy: [{ participant: { lastName: "asc" } }, { participant: { firstName: "asc" } }],
      skip: (query.page - 1) * MATCHING_PAGE_SIZE,
      take: MATCHING_PAGE_SIZE,
    }),
    prisma.eventRegistration.count({ where }),
  ]);
  const ids = registrations.map((r) => r.id);
  const matches = await prisma.match.findMany({
    where: { eventId, OR: [{ aId: { in: ids } }, { bId: { in: ids } }] },
    include: {
      a: { include: { participant: { include: { sector: true } } } },
      b: { include: { participant: { include: { sector: true } } } },
    },
    orderBy: { score: "desc" },
  });
  const rows: RegistrantMatches[] = registrations.map((registration) => ({
    person: summarize(registration),
    matches: matches
      .filter((m) => m.aId === registration.id || m.bId === registration.id)
      .map((m) => {
        const isA = m.aId === registration.id;
        const partner = isA ? m.b : m.a;
        return {
          matchId: m.id,
          partner: summarize(partner),
          score: m.score,
          status: m.status,
          sentences: describeMatch(m.reasons as unknown as MatchReasons, isA ? "a" : "b"),
          isA,
        };
      }),
  }));
  return { rows, total, pageCount: Math.max(1, Math.ceil(total / MATCHING_PAGE_SIZE)) };
}

/** Eligible registrants (for the manual pairing select). */
export async function listEligibleRegistrants(eventId: string): Promise<PersonSummary[]> {
  const registrations = await prisma.eventRegistration.findMany({
    where: {
      eventId,
      status: { not: "CANCELLED" },
      participant: { deletedAt: null, sectorId: { not: null } },
    },
    include: { participant: { include: { sector: true } } },
    orderBy: [{ participant: { lastName: "asc" } }, { participant: { firstName: "asc" } }],
  });
  return registrations.map(summarize);
}
