import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors";
import {
  completeEvent,
  computeBillingFigures,
  createBillingSnapshot,
} from "@/server/services/billing";

/**
 * Section 9: the billing snapshot is written once when the event ends and never updated, even if
 * registrations change afterwards. There is no update function; a second write throws.
 */
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
let organizationId: string;
let eventId: string;

async function addRegistration(
  index: number,
  status: "REGISTERED" | "CONFIRMED" | "CHECKED_IN" | "CANCELLED",
  source: "PLATFORM" | "MANUAL" | "IMPORT",
) {
  const participant = await prisma.participant.create({
    data: {
      organizationId,
      email: `p${index}-${suffix}@test.local`,
      firstName: `P${index}`,
      lastName: "Test",
      companyName: `Cie ${index}`,
      offers: ["x"],
      needs: ["y"],
    },
  });
  return prisma.eventRegistration.create({
    data: {
      eventId,
      participantId: participant.id,
      status,
      source,
      offersSnapshot: ["x"],
      needsSnapshot: ["y"],
      checkedInAt: status === "CHECKED_IN" ? new Date() : null,
    },
  });
}

beforeAll(async () => {
  const organization = await prisma.organization.create({
    data: {
      slug: `billing-${suffix}`,
      name: "Facturation test",
      consentText: "Avis de test",
      privacyEmail: `privacy-${suffix}@test.local`,
      replyToEmail: `reply-${suffix}@test.local`,
    },
  });
  organizationId = organization.id;
  const event = await prisma.event.create({
    data: {
      organizationId,
      slug: "evt",
      name: "Événement facturé",
      startsAt: new Date(Date.now() - 3_600_000),
      status: "PUBLISHED",
    },
  });
  eventId = event.id;
  await addRegistration(1, "CHECKED_IN", "PLATFORM");
  await addRegistration(2, "CHECKED_IN", "MANUAL");
  await addRegistration(3, "REGISTERED", "IMPORT");
  await addRegistration(4, "CONFIRMED", "PLATFORM");
  await addRegistration(5, "CANCELLED", "PLATFORM");
});

afterAll(async () => {
  await prisma.organization.deleteMany({ where: { id: organizationId } });
});

describe("billing snapshot", () => {
  it("counts every non-cancelled registration, presences, and sources (MANUAL + IMPORT = manual)", async () => {
    const figures = await computeBillingFigures(eventId);
    expect(figures).toEqual({
      totalRegistered: 4,
      totalCheckedIn: 2,
      totalPlatformSource: 2,
      totalManualSource: 2,
    });
  });

  it("completing the event marks no-shows, writes the snapshot, and the snapshot never changes", async () => {
    const result = await completeEvent(eventId, organizationId, { actorType: "system" });
    expect(result.noShows).toBe(2);
    expect(result.snapshot.totalRegistered).toBe(4);
    expect(result.snapshot.totalCheckedIn).toBe(2);
    const event = await prisma.event.findUniqueOrThrow({ where: { id: eventId } });
    expect(event.status).toBe("COMPLETED");
    expect(await prisma.eventRegistration.count({ where: { eventId, status: "NO_SHOW" } })).toBe(2);

    // Registrations change after the fact (a late arrival is marked present, someone new is added)…
    await prisma.eventRegistration.updateMany({
      where: { eventId, status: "NO_SHOW" },
      data: { status: "CHECKED_IN", checkedInAt: new Date() },
    });
    await addRegistration(6, "CHECKED_IN", "MANUAL");
    expect((await computeBillingFigures(eventId)).totalCheckedIn).toBe(5);

    // …but the snapshot cannot be rewritten: a second write throws and the row is untouched.
    await expect(
      createBillingSnapshot(eventId, organizationId, { actorType: "system" }),
    ).rejects.toBeInstanceOf(AppError);
    await expect(
      completeEvent(eventId, organizationId, { actorType: "system" }),
    ).rejects.toBeInstanceOf(AppError);
    const stored = await prisma.billingSnapshot.findUniqueOrThrow({ where: { eventId } });
    expect(stored.id).toBe(result.snapshot.id);
    expect(stored.totalRegistered).toBe(4);
    expect(stored.totalCheckedIn).toBe(2);
    expect(stored.computedAt.getTime()).toBe(result.snapshot.computedAt.getTime());
  });
});
