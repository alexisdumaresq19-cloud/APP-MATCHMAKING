import type { BillingSnapshot } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/db/prisma";
import { AppError, NotFoundError } from "@/lib/errors";

export type BillingFigures = {
  totalRegistered: number;
  totalCheckedIn: number;
  totalPlatformSource: number;
  totalManualSource: number;
};

/**
 * Billing counts of an event (section 9): every non-cancelled registration counts, whatever its
 * source; MANUAL and IMPORT are both "manual" for billing purposes.
 */
export async function computeBillingFigures(eventId: string): Promise<BillingFigures> {
  const rows = await prisma.eventRegistration.groupBy({
    by: ["status", "source"],
    where: { eventId, status: { not: "CANCELLED" } },
    _count: { _all: true },
  });
  const figures: BillingFigures = {
    totalRegistered: 0,
    totalCheckedIn: 0,
    totalPlatformSource: 0,
    totalManualSource: 0,
  };
  for (const row of rows) {
    const count = row._count._all;
    figures.totalRegistered += count;
    if (row.status === "CHECKED_IN") figures.totalCheckedIn += count;
    if (row.source === "PLATFORM") figures.totalPlatformSource += count;
    else figures.totalManualSource += count;
  }
  return figures;
}

/**
 * Writes the immutable billing snapshot of an event. There is deliberately no update path: a
 * second call throws and leaves the first snapshot untouched (see the integration test).
 */
export async function createBillingSnapshot(
  eventId: string,
  organizationId: string,
  actor: { actorType: "organizer" | "system"; actorId?: string | null },
): Promise<BillingSnapshot> {
  const event = await prisma.event.findFirst({ where: { id: eventId, organizationId } });
  if (!event) throw new NotFoundError("Cet événement est introuvable.");
  const figures = await computeBillingFigures(eventId);
  try {
    const snapshot = await prisma.billingSnapshot.create({
      data: { organizationId, eventId, ...figures },
    });
    await audit({
      organizationId,
      actorType: actor.actorType,
      actorId: actor.actorId ?? null,
      action: "CREATE",
      entity: "BillingSnapshot",
      entityId: snapshot.id,
      metadata: { eventId, ...figures },
    });
    return snapshot;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new AppError("Le relevé de facturation de cet événement existe déjà; il est figé.");
    }
    throw error;
  }
}

/**
 * « Terminer l'événement » : every REGISTERED/CONFIRMED becomes NO_SHOW, the event becomes
 * COMPLETED and the billing snapshot is written, all in one transaction.
 */
export async function completeEvent(
  eventId: string,
  organizationId: string,
  actor: { actorType: "organizer" | "system"; actorId?: string | null },
): Promise<{ noShows: number; snapshot: BillingSnapshot }> {
  const event = await prisma.event.findFirst({ where: { id: eventId, organizationId } });
  if (!event) throw new NotFoundError("Cet événement est introuvable.");
  if (event.status === "COMPLETED" || event.status === "ARCHIVED") {
    throw new AppError("Cet événement est déjà terminé.");
  }
  const existing = await prisma.billingSnapshot.findUnique({ where: { eventId } });
  if (existing) throw new AppError("Le relevé de facturation de cet événement existe déjà.");

  const noShows = await prisma.$transaction(async (tx) => {
    const updated = await tx.eventRegistration.updateMany({
      where: { eventId, status: { in: ["REGISTERED", "CONFIRMED"] } },
      data: { status: "NO_SHOW" },
    });
    await tx.event.update({ where: { id: eventId }, data: { status: "COMPLETED" } });
    return updated.count;
  });
  const snapshot = await createBillingSnapshot(eventId, organizationId, actor);
  await audit({
    organizationId,
    actorType: actor.actorType,
    actorId: actor.actorId ?? null,
    action: "STATUS_CHANGE",
    entity: "Event",
    entityId: eventId,
    metadata: { from: event.status, to: "COMPLETED", noShows },
  });
  return { noShows, snapshot };
}
