import type { Event, RegistrationStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { pairKey } from "@/lib/matching";
import { roundStartsAt, tableName } from "@/lib/rounds";
import { loadRuleSetForEvent } from "@/server/services/matching";

export type SeatMember = {
  registrationId: string;
  name: string;
  company: string;
  sector: string | null;
  sectorId: string | null;
  status: RegistrationStatus;
  isLocked: boolean;
};

export type TablePlan = {
  id: string;
  number: number;
  label: string | null;
  name: string;
  seats: number;
  members: SeatMember[];
  /** Average match score between the people at the table (null without any match). */
  averageScore: number | null;
  /** Sector names present more than once at the table. */
  conflicts: string[];
};

export type RoundPlan = {
  round: number;
  startsAt: Date;
  tables: TablePlan[];
  unplaced: SeatMember[];
  seated: number;
};

export type SeatingPlan = {
  event: Pick<
    Event,
    "id" | "name" | "startsAt" | "tableCount" | "seatsPerTable" | "roundCount" | "roundMinutes"
  >;
  rounds: RoundPlan[];
  totalActive: number;
  totalSeats: number;
  hasMatches: boolean;
  forbidSameSector: boolean;
  tables: { id: string; number: number; label: string | null; seats: number }[];
};

/** Everything the Tables tab, the exports and the print view need, computed once. */
export async function getSeatingPlan(
  eventId: string,
  organizationId: string,
): Promise<SeatingPlan | null> {
  const event = await prisma.event.findFirst({ where: { id: eventId, organizationId } });
  if (!event) return null;
  const [tables, registrations, matches, ruleSet] = await Promise.all([
    prisma.eventTable.findMany({
      where: { eventId },
      orderBy: { number: "asc" },
      include: { assignments: true },
    }),
    prisma.eventRegistration.findMany({
      where: { eventId, status: { not: "CANCELLED" }, participant: { deletedAt: null } },
      include: { participant: { include: { sector: true } } },
      orderBy: [{ participant: { lastName: "asc" } }, { participant: { firstName: "asc" } }],
    }),
    prisma.match.findMany({
      where: { eventId, status: { not: "EXCLUDED" } },
      select: { aId: true, bId: true, score: true },
    }),
    loadRuleSetForEvent(event),
  ]);
  const score = new Map<string, number>();
  for (const match of matches) score.set(pairKey(match.aId, match.bId), match.score);
  const people = new Map(
    registrations.map((r) => [
      r.id,
      {
        registrationId: r.id,
        name: `${r.participant.firstName} ${r.participant.lastName}`,
        company: r.participant.companyName,
        sector: r.participant.sector?.name ?? null,
        sectorId: r.participant.sectorId,
        status: r.status,
      },
    ]),
  );

  const rounds: RoundPlan[] = [];
  for (let round = 1; round <= event.roundCount; round += 1) {
    const seatedIds = new Set<string>();
    const tablePlans: TablePlan[] = tables.map((table) => {
      const members: SeatMember[] = [];
      for (const assignment of table.assignments) {
        if (assignment.round !== round) continue;
        const person = people.get(assignment.registrationId);
        if (!person) continue; // cancelled since seating: shown as a free seat
        members.push({ ...person, isLocked: assignment.isLocked });
        seatedIds.add(person.registrationId);
      }
      members.sort((a, b) => a.name.localeCompare(b.name, "fr"));
      let total = 0;
      let pairs = 0;
      for (let i = 0; i < members.length; i += 1) {
        for (let j = i + 1; j < members.length; j += 1) {
          const value = score.get(pairKey(members[i].registrationId, members[j].registrationId));
          if (value !== undefined) {
            total += value;
            pairs += 1;
          }
        }
      }
      const bySector = new Map<string, number>();
      for (const member of members) {
        if (member.sector) bySector.set(member.sector, (bySector.get(member.sector) ?? 0) + 1);
      }
      return {
        id: table.id,
        number: table.number,
        label: table.label,
        name: tableName(table),
        seats: table.seats,
        members,
        averageScore: pairs ? Math.round(total / pairs) : null,
        conflicts: [...bySector.entries()].filter(([, count]) => count > 1).map(([name]) => name),
      };
    });
    const unplaced = [...people.values()]
      .filter((person) => !seatedIds.has(person.registrationId))
      .map((person) => ({ ...person, isLocked: false }));
    rounds.push({
      round,
      startsAt: roundStartsAt(event, round),
      tables: tablePlans,
      unplaced,
      seated: seatedIds.size,
    });
  }

  return {
    event: {
      id: event.id,
      name: event.name,
      startsAt: event.startsAt,
      tableCount: event.tableCount,
      seatsPerTable: event.seatsPerTable,
      roundCount: event.roundCount,
      roundMinutes: event.roundMinutes,
    },
    rounds,
    totalActive: registrations.length,
    totalSeats: tables.reduce((sum, t) => sum + t.seats, 0),
    hasMatches: matches.length > 0,
    forbidSameSector: (ruleSet?.penaltySameSector ?? 0) >= 100,
    tables: tables.map((t) => ({ id: t.id, number: t.number, label: t.label, seats: t.seats })),
  };
}
