import type { Event, MatchingRuleSet, Prisma } from "@prisma/client";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/db/prisma";
import { NotFoundError } from "@/lib/errors";
import {
  DEFAULT_RULES,
  pairKey,
  scorePair,
  selectMatches,
  type Affinity,
  type Candidate,
  type PairScore,
  type Rules,
  type SelectionSummary,
} from "@/lib/matching";
import { companyKey } from "@/lib/normalize";

export type IgnoredRegistration = {
  registrationId: string;
  participantId: string;
  name: string;
  reason: "no_sector";
};

export type MatchingRunResult = {
  summary: SelectionSummary;
  ignored: IgnoredRegistration[];
  ruleSetName: string;
  matchedAt: Date;
};

export function rulesFromRuleSet(ruleSet: MatchingRuleSet | null | undefined): Rules {
  if (!ruleSet) return DEFAULT_RULES;
  return {
    weightComplementarity: ruleSet.weightComplementarity,
    weightSectorAffinity: ruleSet.weightSectorAffinity,
    weightRegion: ruleSet.weightRegion,
    weightNovelty: ruleSet.weightNovelty,
    penaltySameSector: ruleSet.penaltySameSector,
    excludeSameCompany: ruleSet.excludeSameCompany,
    minScoreToPropose: ruleSet.minScoreToPropose,
  };
}

/** The event's rule set, else the organization's default, else null (built-in defaults). */
export async function loadRuleSetForEvent(
  event: Pick<Event, "organizationId" | "matchingRuleSetId">,
): Promise<MatchingRuleSet | null> {
  if (event.matchingRuleSetId) {
    const own = await prisma.matchingRuleSet.findFirst({
      where: { id: event.matchingRuleSetId, organizationId: event.organizationId },
    });
    if (own) return own;
  }
  return prisma.matchingRuleSet.findFirst({
    where: { organizationId: event.organizationId, isDefault: true },
    orderBy: { createdAt: "asc" },
  });
}

/** Sector affinity lookup for an organization (symmetric; 50 when unknown). */
export async function loadAffinity(organizationId: string): Promise<Affinity> {
  const rows = await prisma.sectorAffinity.findMany({
    where: { organizationId },
    select: { fromSectorId: true, toSectorId: true, score: true },
  });
  const table = new Map<string, number>();
  for (const row of rows) table.set(pairKey(row.fromSectorId, row.toSectorId), row.score);
  return (a, b) => table.get(pairKey(a, b)) ?? 50;
}

/**
 * Builds the pure candidates of an event: active registrations with a sector (the others are
 * reported as ignored). "Previously met" = shared a table at a COMPLETED event of the organization.
 */
export async function loadCandidates(
  eventId: string,
  organizationId: string,
): Promise<{ candidates: Candidate[]; ignored: IgnoredRegistration[] }> {
  const registrations = await prisma.eventRegistration.findMany({
    where: { eventId, status: { not: "CANCELLED" }, participant: { deletedAt: null } },
    include: { participant: { include: { sector: true } } },
    orderBy: { id: "asc" },
  });
  const participantIds = registrations.map((r) => r.participantId);

  const pastSeats = await prisma.tableAssignment.findMany({
    where: {
      registration: {
        participantId: { in: participantIds },
        event: { organizationId, status: "COMPLETED", id: { not: eventId } },
      },
    },
    select: { tableId: true, round: true, registration: { select: { participantId: true } } },
  });
  const byTable = new Map<string, string[]>();
  for (const seat of pastSeats) {
    const key = `${seat.tableId}#${seat.round}`;
    const list = byTable.get(key) ?? [];
    list.push(seat.registration.participantId);
    byTable.set(key, list);
  }
  const met = new Map<string, Set<string>>();
  for (const list of byTable.values()) {
    for (const a of list) {
      const set = met.get(a) ?? new Set<string>();
      for (const b of list) if (a !== b) set.add(b);
      met.set(a, set);
    }
  }

  const candidates: Candidate[] = [];
  const ignored: IgnoredRegistration[] = [];
  for (const registration of registrations) {
    const p = registration.participant;
    if (!p.sectorId) {
      ignored.push({
        registrationId: registration.id,
        participantId: p.id,
        name: `${p.firstName} ${p.lastName}`,
        reason: "no_sector",
      });
      continue;
    }
    candidates.push({
      registrationId: registration.id,
      participantId: p.id,
      companyKey: companyKey(p.companyName),
      sectorId: p.sectorId,
      sectorName: p.sector?.name ?? null,
      region: p.region,
      offers: registration.offersSnapshot.length ? registration.offersSnapshot : p.offers,
      needs: registration.needsSnapshot.length ? registration.needsSnapshot : p.needs,
      soughtSectorIds: registration.soughtSectorsSnapshot.length
        ? registration.soughtSectorsSnapshot
        : p.soughtSectorIds,
      previouslyMetIds: met.get(p.id) ?? new Set<string>(),
    });
  }
  return { candidates, ignored };
}

/**
 * Runs the matching for an event and persists the result:
 * PROPOSED matches are replaced, PINNED ones are kept (score refreshed), EXCLUDED ones are kept.
 */
export async function runMatchingForEvent(
  eventId: string,
  organizationId: string,
  actor: { actorType: "organizer" | "system"; actorId?: string | null },
): Promise<MatchingRunResult> {
  const event = await prisma.event.findFirst({ where: { id: eventId, organizationId } });
  if (!event) throw new NotFoundError("Cet événement est introuvable.");

  const [ruleSet, affinity, { candidates, ignored }, existing] = await Promise.all([
    loadRuleSetForEvent(event),
    loadAffinity(organizationId),
    loadCandidates(eventId, organizationId),
    prisma.match.findMany({
      where: { eventId },
      select: { id: true, aId: true, bId: true, status: true },
    }),
  ]);
  const rules = rulesFromRuleSet(ruleSet);
  const pinned = new Set(
    existing.filter((m) => m.status === "PINNED").map((m) => pairKey(m.aId, m.bId)),
  );
  const excluded = new Set(
    existing.filter((m) => m.status === "EXCLUDED").map((m) => pairKey(m.aId, m.bId)),
  );

  const selection = selectMatches({
    candidates,
    rules,
    affinity,
    matchesPerParticipant: event.matchesPerParticipant,
    pinned,
    excluded,
  });

  const matchedAt = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.match.deleteMany({ where: { eventId, status: "PROPOSED" } });
    const proposed: Prisma.MatchCreateManyInput[] = [];
    for (const match of selection.matches) {
      const data = {
        score: match.score,
        reasons: match.reasons as unknown as Prisma.InputJsonValue,
        rank: match.rank,
      };
      if (match.pinned) {
        await tx.match.updateMany({ where: { eventId, aId: match.aId, bId: match.bId }, data });
      } else {
        proposed.push({ eventId, aId: match.aId, bId: match.bId, status: "PROPOSED", ...data });
      }
    }
    if (proposed.length) await tx.match.createMany({ data: proposed });
    await tx.event.update({
      where: { id: eventId },
      data: { matchedAt, ...(event.status === "CLOSED" ? { status: "MATCHED" as const } : {}) },
    });
  });

  await audit({
    organizationId,
    actorType: actor.actorType,
    actorId: actor.actorId ?? null,
    action: "MATCH_RUN",
    entity: "Event",
    entityId: eventId,
    metadata: {
      eligible: selection.summary.eligible,
      ignored: ignored.length,
      totalMatches: selection.summary.totalMatches,
      averageScore: selection.summary.averageScore,
      ruleSet: ruleSet?.name ?? "défaut",
    },
  });

  return {
    summary: selection.summary,
    ignored,
    ruleSetName: ruleSet?.name ?? "Règles par défaut",
    matchedAt,
  };
}

/** Scores one specific pair with the event's current rules (used for manual pins). */
export async function scorePairForEvent(
  eventId: string,
  organizationId: string,
  registrationA: string,
  registrationB: string,
): Promise<PairScore | null> {
  const event = await prisma.event.findFirst({ where: { id: eventId, organizationId } });
  if (!event) return null;
  const [ruleSet, affinity, { candidates }] = await Promise.all([
    loadRuleSetForEvent(event),
    loadAffinity(organizationId),
    loadCandidates(eventId, organizationId),
  ]);
  const a = candidates.find((c) => c.registrationId === registrationA);
  const b = candidates.find((c) => c.registrationId === registrationB);
  if (!a || !b) return null;
  return scorePair(a, b, rulesFromRuleSet(ruleSet), affinity);
}

/** All scored pairs for one registration, best first (the "voir toutes les paires" view). */
export async function scoreAllPairsFor(
  eventId: string,
  organizationId: string,
  registrationId: string,
): Promise<PairScore[]> {
  const event = await prisma.event.findFirst({ where: { id: eventId, organizationId } });
  if (!event) return [];
  const [ruleSet, affinity, { candidates }] = await Promise.all([
    loadRuleSetForEvent(event),
    loadAffinity(organizationId),
    loadCandidates(eventId, organizationId),
  ]);
  const self = candidates.find((c) => c.registrationId === registrationId);
  if (!self) return [];
  const rules = rulesFromRuleSet(ruleSet);
  return candidates
    .filter((c) => c.registrationId !== registrationId)
    .map((other) => scorePair(self, other, rules, affinity))
    .sort((x, y) => y.score - x.score);
}
