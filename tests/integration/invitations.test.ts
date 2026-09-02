import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors";
import {
  getInvitationOverview,
  runInvitationBatch,
  startInvitations,
} from "@/server/services/invitations";
import { registerWithProfile } from "@/server/services/quick-registration";

/**
 * D-35: invitations reach only directory members who are not registered, did not opt out and were
 * not invited yet; the one-click registration reuses the profile and logs consent when needed.
 */
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
let organizationId: string;
let ownerId: string;
let eventId: string;
const emails = {
  alice: `alice-${suffix}@test.local`,
  registered: `bob-${suffix}@test.local`,
  cancelled: `chloe-${suffix}@test.local`,
  optedOut: `dan-${suffix}@test.local`,
  anonymized: `supprime-${suffix}@anonyme.invalid`,
  fanny: `fanny-${suffix}@test.local`,
};

beforeAll(async () => {
  const organization = await prisma.organization.create({
    data: {
      slug: `invites-${suffix}`,
      name: "Org invitations",
      consentText: "Texte de consentement de test, assez long pour la validation du formulaire.",
      consentVersion: `v-${suffix}`,
      privacyEmail: `privacy-${suffix}@test.local`,
      replyToEmail: `reply-${suffix}@test.local`,
      organizers: {
        create: { email: `owner-${suffix}@test.local`, name: "Propriétaire", role: "OWNER" },
      },
      events: {
        create: {
          slug: `ev-${suffix}`,
          name: "Soirée invitations",
          startsAt: new Date(Date.now() + 7 * 86_400_000),
          status: "OPEN",
          capacity: 50,
        },
      },
    },
    include: { organizers: true, events: true },
  });
  organizationId = organization.id;
  ownerId = organization.organizers[0].id;
  eventId = organization.events[0].id;

  const person = (email: string, firstName: string, extra: object = {}) => ({
    organizationId,
    email,
    firstName,
    lastName: "Test",
    companyName: `${firstName} inc.`,
    offers: ["service"],
    needs: ["clients"],
    ...extra,
  });
  await prisma.participant.create({
    data: person(emails.alice, "Alice", {
      consents: { create: { consentVersion: `v-${suffix}`, consentText: "texte" } },
    }),
  });
  await prisma.participant.create({
    data: person(emails.registered, "Bob", {
      registrations: {
        create: { eventId, status: "REGISTERED", offersSnapshot: [], needsSnapshot: [] },
      },
    }),
  });
  await prisma.participant.create({
    data: person(emails.cancelled, "Chloé", {
      registrations: {
        create: {
          eventId,
          status: "CANCELLED",
          cancelledAt: new Date(),
          offersSnapshot: [],
          needsSnapshot: [],
        },
      },
    }),
  });
  await prisma.participant.create({
    data: person(emails.optedOut, "Dan", { invitationsOptOut: true }),
  });
  await prisma.participant.create({
    data: person(emails.anonymized, "Participant", { deletedAt: new Date() }),
  });
  await prisma.participant.create({ data: person(emails.fanny, "Fanny") });
});

afterAll(async () => {
  await prisma.organization.deleteMany({ where: { id: organizationId } });
  await prisma.$disconnect();
});

describe("invitations to past participants", () => {
  it("counts only the people who can still be invited", async () => {
    const overview = await getInvitationOverview(eventId, organizationId);
    expect(overview.registrationOpen).toBe(true);
    expect(overview.invitable).toBe(2); // Alice and Fanny
    expect(overview.optedOut).toBe(1);
    expect(overview.sent).toBe(0);
    expect(overview.startedAt).toBeNull();
  });

  it("requires an explicit start, then sends once per person in batches", async () => {
    await expect(runInvitationBatch(eventId, organizationId, 20)).rejects.toBeInstanceOf(AppError);
    await startInvitations(eventId, organizationId, { actorType: "organizer", actorId: ownerId });

    const first = await runInvitationBatch(eventId, organizationId, 1);
    expect(first).toEqual({ sent: 1, failed: 0, remaining: 1, total: 2 });
    const second = await runInvitationBatch(eventId, organizationId, 1);
    // The queue is recomputed at each call: the person already invited is gone from it.
    expect(second).toEqual({ sent: 1, failed: 0, remaining: 0, total: 1 });
    const third = await runInvitationBatch(eventId, organizationId, 20);
    expect(third.total).toBe(0);

    const logs = await prisma.emailLog.findMany({
      where: { eventId, template: "event_invitation" },
      orderBy: { createdAt: "asc" },
    });
    expect(logs.map((l) => l.toEmail).sort()).toEqual([emails.alice, emails.fanny].sort());
    for (const log of logs) {
      expect(log.status).toBe("sent");
      expect(log.previewText).toMatch(/\/inscription-rapide\?token=/);
      expect(log.previewText).toMatch(/\/invitations/);
    }
    const overview = await getInvitationOverview(eventId, organizationId);
    expect(overview.invitable).toBe(0);
    expect(overview.sent).toBe(2);
    expect(overview.startedAt).not.toBeNull();
  });

  it("refuses to start when registrations are closed", async () => {
    await prisma.event.update({ where: { id: eventId }, data: { status: "CLOSED" } });
    await expect(
      startInvitations(eventId, organizationId, { actorType: "organizer", actorId: ownerId }),
    ).rejects.toThrow(/ne sont pas ouvertes/);
    await prisma.event.update({ where: { id: eventId }, data: { status: "OPEN" } });
  });
});

describe("registerWithProfile", () => {
  async function load(email: string) {
    const participant = await prisma.participant.findFirstOrThrow({
      where: { organizationId, email },
      include: { sector: true },
    });
    const event = await prisma.event.findFirstOrThrow({
      where: { id: eventId },
      include: { organization: true },
    });
    return { participant, event };
  }

  it("registers with the current profile once, and reports an existing registration", async () => {
    const { participant, event } = await load(emails.alice);
    const first = await registerWithProfile({
      participant,
      event,
      goalsText: "Rencontrer des clients",
      consentAccepted: false, // Alice already accepted the current notice
      ip: "203.0.113.1",
      userAgent: "Test/1.0",
    });
    expect(first).toEqual({ ok: true, alreadyRegistered: false });
    const registration = await prisma.eventRegistration.findUniqueOrThrow({
      where: { eventId_participantId: { eventId, participantId: participant.id } },
    });
    expect(registration.status).toBe("REGISTERED");
    expect(registration.offersSnapshot).toEqual(["service"]);
    expect(registration.goalsText).toBe("Rencontrer des clients");

    const again = await registerWithProfile({
      participant,
      event,
      goalsText: null,
      consentAccepted: false,
      ip: null,
      userAgent: null,
    });
    expect(again).toEqual({ ok: true, alreadyRegistered: true });
    const confirmation = await prisma.emailLog.count({
      where: { eventId, template: "registration_confirmed", toEmail: emails.alice },
    });
    expect(confirmation).toBe(1);
  });

  it("asks for the consent when the current notice was never accepted, then logs it", async () => {
    const { participant, event } = await load(emails.fanny);
    const refused = await registerWithProfile({
      participant,
      event,
      goalsText: null,
      consentAccepted: false,
      ip: null,
      userAgent: null,
    });
    expect(refused).toEqual({ ok: false, reason: "consent_required" });
    const accepted = await registerWithProfile({
      participant,
      event,
      goalsText: null,
      consentAccepted: true,
      ip: "203.0.113.2",
      userAgent: "Test/1.0",
    });
    expect(accepted).toEqual({ ok: true, alreadyRegistered: false });
    const consent = await prisma.consentLog.findFirst({
      where: { participantId: participant.id, consentVersion: `v-${suffix}` },
    });
    expect(consent?.ipAddress).toBe("203.0.113.2");
  });
});
