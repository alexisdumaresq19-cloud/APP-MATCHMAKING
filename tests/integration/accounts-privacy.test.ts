import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors";
import { inviteOrganizer, setOrganizerActive, setOrganizerRole } from "@/server/services/accounts";
import { anonymizeParticipant, requestDeletion } from "@/server/services/privacy";

/**
 * Week 4 guards: an organization always keeps one active owner (S4-03), and the Law 25 deletion
 * anonymizes without touching what billing counts (S4-05).
 */
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
let organizationId: string;
let ownerId: string;
let eventId: string;

beforeAll(async () => {
  const organization = await prisma.organization.create({
    data: {
      slug: `guards-${suffix}`,
      name: "Org gardes",
      consentText: "Texte de consentement de test, assez long pour la validation du formulaire.",
      consentVersion: `v-${suffix}`,
      privacyEmail: `privacy-${suffix}@test.local`,
      replyToEmail: `reply-${suffix}@test.local`,
      organizers: {
        create: {
          email: `owner-${suffix}@test.local`,
          name: "Propriétaire",
          role: "OWNER",
          passwordHash: "x",
        },
      },
      events: {
        create: {
          slug: `ev-${suffix}`,
          name: "Événement gardes",
          startsAt: new Date(Date.now() + 86_400_000),
          status: "OPEN",
        },
      },
    },
    include: { organizers: true, events: true },
  });
  organizationId = organization.id;
  ownerId = organization.organizers[0].id;
  eventId = organization.events[0].id;
});

afterAll(async () => {
  await prisma.organization.deleteMany({ where: { id: organizationId } });
  await prisma.$disconnect();
});

const actor = () => ({ organizerId: ownerId, organizerName: "Propriétaire" });

describe("accounts: at least one active owner", () => {
  it("refuses to demote or deactivate the last active owner", async () => {
    await expect(
      setOrganizerRole(organizationId, ownerId, "STAFF", actor()),
    ).rejects.toBeInstanceOf(AppError);
    await expect(setOrganizerActive(organizationId, ownerId, false, actor())).rejects.toThrow(
      /propre compte/,
    );
    const owner = await prisma.organizer.findUniqueOrThrow({ where: { id: ownerId } });
    expect(owner.role).toBe("OWNER");
    expect(owner.isActive).toBe(true);
  });

  it("invites a second owner without a password, then allows the demotion", async () => {
    const { organizer } = await inviteOrganizer(
      organizationId,
      { email: `second-${suffix}@test.local`, name: "Seconde", role: "OWNER" },
      actor(),
    );
    expect(organizer.passwordHash).toBeNull();
    const token = await prisma.organizerToken.findFirst({
      where: { organizerId: organizer.id, purpose: "INVITE" },
    });
    expect(token).not.toBeNull();
    await expect(
      inviteOrganizer(
        organizationId,
        { email: `second-${suffix}@test.local`, name: "Doublon", role: "STAFF" },
        actor(),
      ),
    ).rejects.toThrow(/existe déjà/);

    // Two active owners: the first can now become STAFF, and the change signs them out.
    const before = await prisma.organizer.findUniqueOrThrow({ where: { id: ownerId } });
    await setOrganizerRole(organizationId, ownerId, "STAFF", actor());
    const after = await prisma.organizer.findUniqueOrThrow({ where: { id: ownerId } });
    expect(after.role).toBe("STAFF");
    expect(after.sessionVersion).toBe(before.sessionVersion + 1);

    // …but the remaining owner cannot be deactivated by anyone.
    await expect(setOrganizerActive(organizationId, organizer.id, false, actor())).rejects.toThrow(
      /au moins un propriétaire/,
    );
    await setOrganizerRole(organizationId, ownerId, "OWNER", actor());
  });
});

describe("privacy: deletion request and anonymization", () => {
  it("keeps the registration for billing, erases the person, revokes the links", async () => {
    const participant = await prisma.participant.create({
      data: {
        organizationId,
        email: `marie-${suffix}@test.local`,
        firstName: "Marie",
        lastName: "Tremblay",
        phone: "+14185551234",
        companyName: "Traiteur Tremblay",
        offers: ["traiteur"],
        needs: ["clients"],
        description: "Une belle entreprise.",
        consents: {
          create: {
            consentVersion: `v-${suffix}`,
            consentText: "texte",
            ipAddress: "203.0.113.9",
            userAgent: "Test/1.0",
          },
        },
        registrations: {
          create: {
            eventId,
            status: "CHECKED_IN",
            source: "PLATFORM",
            offersSnapshot: ["traiteur"],
            needsSnapshot: ["clients"],
            goalsText: "Trouver des clients.",
            checkedInAt: new Date(),
          },
        },
      },
    });
    const organization = await prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
    });

    await requestDeletion(participant, organization);
    await requestDeletion(participant, organization); // idempotent while PENDING
    expect(await prisma.deletionRequest.count({ where: { participantId: participant.id } })).toBe(
      1,
    );

    await anonymizeParticipant(organizationId, participant.id, {
      organizerId: ownerId,
      note: "Demande traitée",
    });

    const after = await prisma.participant.findUniqueOrThrow({
      where: { id: participant.id },
      include: { registrations: true, consents: true, deletionRequests: true },
    });
    expect(after.deletedAt).not.toBeNull();
    expect(after.firstName).toBe("Participant");
    expect(after.email).toMatch(/@anonyme\.invalid$/);
    expect(after.phone).toBeNull();
    expect(after.description).toBeNull();
    expect(after.tokenVersion).toBe(participant.tokenVersion + 1);
    // Billing still counts this person: the registration and its status are untouched.
    expect(after.registrations).toHaveLength(1);
    expect(after.registrations[0].status).toBe("CHECKED_IN");
    expect(after.registrations[0].checkedInAt).not.toBeNull();
    expect(after.registrations[0].goalsText).toBeNull();
    // The consent proof stays, without the technical identifiers.
    expect(after.consents).toHaveLength(1);
    expect(after.consents[0].ipAddress).toBeNull();
    expect(after.deletionRequests[0].status).toBe("COMPLETED");
    expect(after.deletionRequests[0].note).toBe("Demande traitée");

    await expect(
      anonymizeParticipant(organizationId, participant.id, { organizerId: ownerId }),
    ).rejects.toThrow(/déjà anonymisé/);
    const confirmation = await prisma.emailLog.findFirst({
      where: {
        organizationId,
        template: "deletion_confirmed",
        toEmail: `marie-${suffix}@test.local`,
      },
    });
    expect(confirmation).not.toBeNull();
  });
});
