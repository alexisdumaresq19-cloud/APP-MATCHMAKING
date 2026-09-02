import type { Event, EventTable, Prisma } from "@prisma/client";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/db/prisma";
import { AppError, NotFoundError } from "@/lib/errors";
import { assignSeats, type SeatingReport } from "@/lib/matching";
import { seatingSeed } from "@/lib/rounds";
import { loadRuleSetForEvent } from "./matching";

export type SeatingRunResult = {
  report: SeatingReport;
  placed: number;
  unplaced: number;
  rounds: number;
};

type Actor = { actorType: "organizer" | "system"; actorId?: string | null };

/**
 * Makes the EventTable rows match the event configuration: creates missing numbers, removes extra
 * ones (their seats go with them), and aligns `seats` with `seatsPerTable`. Labels are kept.
 */
export async function ensureTables(event: Event): Promise<EventTable[]> {
  const existing = await prisma.eventTable.findMany({
    where: { eventId: event.id },
    orderBy: { number: "asc" },
  });
  const byNumber = new Map(existing.map((t) => [t.number, t]));
  const creates: Prisma.EventTableCreateManyInput[] = [];
  for (let number = 1; number <= event.tableCount; number += 1) {
    if (!byNumber.has(number)) {
      creates.push({ eventId: event.id, number, seats: event.seatsPerTable });
    }
  }
  const extra = existing.filter((t) => t.number > event.tableCount).map((t) => t.id);
  await prisma.$transaction([
    ...(creates.length ? [prisma.eventTable.createMany({ data: creates })] : []),
    ...(extra.length ? [prisma.eventTable.deleteMany({ where: { id: { in: extra } } })] : []),
    prisma.eventTable.updateMany({
      where: { eventId: event.id, number: { lte: event.tableCount } },
      data: { seats: event.seatsPerTable },
    }),
  ]);
  return prisma.eventTable.findMany({ where: { eventId: event.id }, orderBy: { number: "asc" } });
}

async function eventOf(eventId: string, organizationId: string): Promise<Event> {
  const event = await prisma.event.findFirst({ where: { id: eventId, organizationId } });
  if (!event) throw new NotFoundError("Cet événement est introuvable.");
  return event;
}

/**
 * Seats every active registrant for every round (section 7.5). Locked seats are kept exactly
 * where the organizer put them; everything else is recomputed from the current matches.
 */
export async function runSeatingForEvent(
  eventId: string,
  organizationId: string,
  actor: Actor,
): Promise<SeatingRunResult> {
  const event = await eventOf(eventId, organizationId);
  const tables = await ensureTables(event);
  const [registrations, matches, lockedRows, ruleSet] = await Promise.all([
    prisma.eventRegistration.findMany({
      where: { eventId, status: { not: "CANCELLED" }, participant: { deletedAt: null } },
      select: { id: true, participant: { select: { sectorId: true } } },
      orderBy: { id: "asc" },
    }),
    prisma.match.findMany({
      where: { eventId, status: { not: "EXCLUDED" } },
      select: { aId: true, bId: true, score: true, status: true },
    }),
    prisma.tableAssignment.findMany({
      where: { isLocked: true, registration: { eventId } },
      select: { registrationId: true, round: true, tableId: true },
    }),
    loadRuleSetForEvent(event),
  ]);
  if (registrations.length === 0) throw new AppError("Aucun inscrit à placer.");
  const tableIds = new Set(tables.map((t) => t.id));
  const activeIds = new Set(registrations.map((r) => r.id));
  const locked = lockedRows.filter(
    (row) =>
      tableIds.has(row.tableId) &&
      activeIds.has(row.registrationId) &&
      row.round <= event.roundCount,
  );

  const { assignments, report } = assignSeats({
    participants: registrations.map((r) => ({
      registrationId: r.id,
      sectorId: r.participant.sectorId,
    })),
    matches: matches.map((m) => ({
      aId: m.aId,
      bId: m.bId,
      score: m.score,
      pinned: m.status === "PINNED",
    })),
    tables: tables.map((t) => ({ id: t.id, seats: t.seats })),
    rounds: event.roundCount,
    locked,
    forbidSameSector: (ruleSet?.penaltySameSector ?? 0) >= 100,
    seed: seatingSeed(event.id),
    timeBudgetMs: 1500,
  });

  const lockedKeys = new Set(locked.map((l) => `${l.registrationId}#${l.round}`));
  const fresh = assignments.filter((a) => !lockedKeys.has(`${a.registrationId}#${a.round}`));
  await prisma.$transaction([
    prisma.tableAssignment.deleteMany({ where: { isLocked: false, registration: { eventId } } }),
    prisma.tableAssignment.createMany({
      data: fresh.map((a) => ({
        tableId: a.tableId,
        registrationId: a.registrationId,
        round: a.round,
        isLocked: false,
      })),
    }),
  ]);

  await audit({
    organizationId,
    actorType: actor.actorType,
    actorId: actor.actorId ?? null,
    action: "UPDATE",
    entity: "Event",
    entityId: eventId,
    metadata: {
      seating: {
        placed: assignments.length,
        unplaced: report.unplaced.length,
        totalScore: report.totalScore,
        relaxedSameSector: report.relaxedSameSector,
      },
    },
  });

  return {
    report,
    placed: assignments.length,
    unplaced: report.unplaced.length,
    rounds: event.roundCount,
  };
}

/** Moves (or unseats when tableId is null) one registrant for one round; a manual move locks it. */
export async function moveSeat(
  eventId: string,
  organizationId: string,
  registrationId: string,
  round: number,
  tableId: string | null,
): Promise<void> {
  const event = await eventOf(eventId, organizationId);
  if (round < 1 || round > event.roundCount) throw new AppError("Cette ronde n'existe pas.");
  const registration = await prisma.eventRegistration.findFirst({
    where: { id: registrationId, eventId, status: { not: "CANCELLED" } },
    select: { id: true },
  });
  if (!registration) throw new NotFoundError("Cet inscrit est introuvable.");
  if (tableId === null) {
    await prisma.tableAssignment.deleteMany({ where: { registrationId, round } });
    return;
  }
  const table = await prisma.eventTable.findFirst({
    where: { id: tableId, eventId },
    include: { _count: { select: { assignments: { where: { round } } } } },
  });
  if (!table) throw new NotFoundError("Cette table est introuvable.");
  const already = await prisma.tableAssignment.findUnique({
    where: { registrationId_round: { registrationId, round } },
  });
  if (already?.tableId !== tableId && table._count.assignments >= table.seats) {
    throw new AppError("Cette table est pleine.");
  }
  await prisma.tableAssignment.upsert({
    where: { registrationId_round: { registrationId, round } },
    create: { registrationId, round, tableId, isLocked: true },
    update: { tableId, isLocked: true },
  });
}

export async function setSeatLock(
  eventId: string,
  organizationId: string,
  registrationId: string,
  round: number,
  isLocked: boolean,
): Promise<void> {
  await eventOf(eventId, organizationId);
  const updated = await prisma.tableAssignment.updateMany({
    where: { registrationId, round, registration: { eventId } },
    data: { isLocked },
  });
  if (updated.count === 0) throw new NotFoundError("Cette place est introuvable.");
}

/** Removes every seat of a round (or of the whole event), locked ones included. */
export async function clearSeating(
  eventId: string,
  organizationId: string,
  round?: number,
): Promise<number> {
  await eventOf(eventId, organizationId);
  const result = await prisma.tableAssignment.deleteMany({
    where: { registration: { eventId }, ...(round ? { round } : {}) },
  });
  return result.count;
}
