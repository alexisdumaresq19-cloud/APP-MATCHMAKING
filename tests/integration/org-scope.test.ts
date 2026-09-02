import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { orgEvent, orgParticipant, orgRegistration } from "@/lib/db/org-scope";
import { NotFoundError } from "@/lib/errors";

/**
 * Proves the organization isolation rule (DECISIONS.md D-09):
 * an organizer of organization A can never read an entity of organization B by id.
 */
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
let orgA: { id: string };
let orgB: { id: string };
let eventA: { id: string };
let participantA: { id: string };
let registrationA: { id: string };

function orgData(slug: string) {
  return {
    slug,
    name: slug,
    consentText: "Avis de test",
    privacyEmail: `privacy-${slug}@test.local`,
    replyToEmail: `reply-${slug}@test.local`,
  };
}

beforeAll(async () => {
  orgA = await prisma.organization.create({ data: orgData(`iso-a-${suffix}`) });
  orgB = await prisma.organization.create({ data: orgData(`iso-b-${suffix}`) });
  eventA = await prisma.event.create({
    data: {
      organizationId: orgA.id,
      slug: "evt",
      name: "Événement A",
      startsAt: new Date(Date.now() + 86_400_000),
    },
  });
  participantA = await prisma.participant.create({
    data: {
      organizationId: orgA.id,
      email: `p-${suffix}@test.local`,
      firstName: "Test",
      lastName: "Isolation",
      companyName: "Entreprise A",
      offers: ["x"],
      needs: ["y"],
    },
  });
  registrationA = await prisma.eventRegistration.create({
    data: {
      eventId: eventA.id,
      participantId: participantA.id,
      offersSnapshot: ["x"],
      needsSnapshot: ["y"],
    },
  });
});

afterAll(async () => {
  await prisma.organization.deleteMany({ where: { id: { in: [orgA.id, orgB.id] } } });
  await prisma.$disconnect();
});

describe("organization scoping", () => {
  it("returns entities of the organizer's own organization", async () => {
    expect((await orgEvent(orgA.id, eventA.id)).id).toBe(eventA.id);
    expect((await orgParticipant(orgA.id, participantA.id)).id).toBe(participantA.id);
    expect((await orgRegistration(orgA.id, registrationA.id)).id).toBe(registrationA.id);
  });

  it("refuses entities of another organization, even with a valid id", async () => {
    await expect(orgEvent(orgB.id, eventA.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(orgParticipant(orgB.id, participantA.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(orgRegistration(orgB.id, registrationA.id)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("allows the same email as two distinct participants in two organizations", async () => {
    const twin = await prisma.participant.create({
      data: {
        organizationId: orgB.id,
        email: `p-${suffix}@test.local`,
        firstName: "Autre",
        lastName: "Personne",
        companyName: "Entreprise B",
        offers: [],
        needs: [],
      },
    });
    expect(twin.id).not.toBe(participantA.id);
    await expect(
      prisma.participant.create({
        data: {
          organizationId: orgA.id,
          email: `p-${suffix}@test.local`,
          firstName: "Doublon",
          lastName: "Interdit",
          companyName: "X",
          offers: [],
          needs: [],
        },
      }),
    ).rejects.toThrow();
  });
});
