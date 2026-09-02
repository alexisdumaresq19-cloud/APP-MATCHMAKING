import { prisma } from "@/lib/db/prisma";
import { tableName } from "@/lib/rounds";
import type { CheckinRow } from "@/components/admin/checkin/checkin-board";

/** Alphabetical list for the door, with the round-1 table of each person. */
export async function listCheckinRows(eventId: string): Promise<CheckinRow[]> {
  const registrations = await prisma.eventRegistration.findMany({
    where: { eventId, status: { not: "CANCELLED" }, participant: { deletedAt: null } },
    include: {
      participant: { include: { sector: true } },
      assignments: { where: { round: 1 }, include: { table: true } },
    },
    orderBy: [{ participant: { lastName: "asc" } }, { participant: { firstName: "asc" } }],
  });
  return registrations.map((r) => ({
    registrationId: r.id,
    name: `${r.participant.firstName} ${r.participant.lastName}`,
    company: r.participant.companyName,
    sector: r.participant.sector?.name ?? null,
    status: r.status as CheckinRow["status"],
    checkedInAt: r.checkedInAt?.toISOString() ?? null,
    table: r.assignments[0] ? tableName(r.assignments[0].table) : null,
    initial: (r.participant.lastName[0] ?? r.participant.firstName[0] ?? "?").toUpperCase(),
  }));
}
