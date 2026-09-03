import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors";
import {
  eventSurveySummary,
  listMatchesForFeedback,
  runSurveyBatch,
  saveEventFeedback,
  startSurvey,
} from "@/server/services/feedback";
import { affinitySuggestions, applyAffinity } from "@/server/services/learning";
import { keepProfile, runRetention } from "@/server/services/retention";

/** P2-S3: the post-event survey (D-38), the suggestions it feeds, and automatic retention (D-39). */
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
let organizationId: string;
let ownerId: string;
let eventId: string;
let sectorA: string;
let sectorB: string;
let alice = "";
let aliceMatch = "";

async function pair(index: number, status: "CHECKED_IN" | "CONFIRMED") {
  const [x, y] = await Promise.all([
    prisma.participant.create({
      data: {
        organizationId,
        email: `x${index}-${suffix}@test.local`,
        firstName: `X${index}`,
        lastName: "Test",
        companyName: `Cie X${index}`,
        sectorId: sectorA,
        offers: ["a"],
        needs: ["b"],
        consents: { create: { consentVersion: `v-${suffix}`, consentText: "texte" } },
      },
    }),
    prisma.participant.create({
      data: {
        organizationId,
        email: `y${index}-${suffix}@test.local`,
        firstName: `Y${index}`,
        lastName: "Test",
        companyName: `Cie Y${index}`,
        sectorId: sectorB,
        offers: ["b"],
        needs: ["a"],
        consents: { create: { consentVersion: `v-${suffix}`, consentText: "texte" } },
      },
    }),
  ]);
  const [rx, ry] = await Promise.all(
    [x, y].map((p) =>
      prisma.eventRegistration.create({
        data: { eventId, participantId: p.id, status, offersSnapshot: [], needsSnapshot: [] },
      }),
    ),
  );
  const [first, second] = rx.id < ry.id ? [rx, ry] : [ry, rx];
  const match = await prisma.match.create({
    data: { eventId, aId: first.id, bId: second.id, score: 70, status: "PROPOSED", reasons: {} },
  });
  return { x, y, match };
}

beforeAll(async () => {
  const organization = await prisma.organization.create({
    data: {
      slug: `bilan-${suffix}`,
      name: "Org bilan",
      consentText: "Texte de consentement de test, assez long pour la validation du formulaire.",
      consentVersion: `v-${suffix}`,
      privacyEmail: `privacy-${suffix}@test.local`,
      replyToEmail: `reply-${suffix}@test.local`,
      organizers: { create: { email: `owner-${suffix}@test.local`, name: "Owner", role: "OWNER" } },
      sectors: {
        create: [
          { name: "Garderie", slug: "garderie", sortOrder: 0 },
          { name: "Traiteur", slug: "traiteur", sortOrder: 1 },
        ],
      },
      events: {
        create: {
          slug: `ev-${suffix}`,
          name: "Soirée terminée",
          startsAt: new Date(Date.now() - 2 * 86_400_000),
          status: "COMPLETED",
          publishedAt: new Date(Date.now() - 3 * 86_400_000),
        },
      },
    },
    include: { organizers: true, sectors: true, events: true },
  });
  organizationId = organization.id;
  ownerId = organization.organizers[0].id;
  eventId = organization.events[0].id;
  [sectorA, sectorB] = [organization.sectors[0].id, organization.sectors[1].id];
  const main = await pair(0, "CHECKED_IN");
  alice = main.x.id;
  aliceMatch = main.match.id;
  // Four more rated pairs (not checked in: they are not survey targets) to reach the sample size.
  for (let i = 1; i <= 4; i += 1) {
    const extra = await pair(i, "CONFIRMED");
    await prisma.matchFeedback.create({
      data: { matchId: extra.match.id, participantId: extra.x.id, outcome: "DEAL" },
    });
  }
});

afterAll(async () => {
  await prisma.organization.deleteMany({ where: { id: organizationId } });
  await prisma.$disconnect();
});

describe("post-event survey", () => {
  it("lists the rater's matches, saves and updates answers, summarizes them", async () => {
    const data = await listMatchesForFeedback(alice, eventId);
    expect(data?.rows).toHaveLength(1);
    expect(data?.rows[0].partnerCompany).toBe("Cie Y0");
    expect(data?.rows[0].outcome).toBeNull();

    const saved = await saveEventFeedback(organizationId, alice, eventId, [
      { matchId: aliceMatch, outcome: "FOLLOW_UP", comment: "On se rappelle" },
      { matchId: "not-mine", outcome: "DEAL", comment: null },
    ]);
    expect(saved).toBe(1);
    await saveEventFeedback(organizationId, alice, eventId, [
      { matchId: aliceMatch, outcome: "DEAL", comment: "Contrat signé!" },
    ]);
    const after = await listMatchesForFeedback(alice, eventId);
    expect(after?.rows[0].outcome).toBe("DEAL");
    expect(after?.rows[0].comment).toBe("Contrat signé!");

    const summary = await eventSurveySummary(eventId, organizationId);
    expect(summary.eligible).toBe(2); // Alice and Bob attended and have a match
    expect(summary.responses).toBe(5); // Alice + the four extra raters
    expect(summary.byOutcome.DEAL).toBe(5);
    expect(summary.comments[0]?.comment).toBe("Contrat signé!");
  });

  it("sends the survey once to people who attended, after an explicit start", async () => {
    await expect(runSurveyBatch(eventId, organizationId, 20)).rejects.toBeInstanceOf(AppError);
    await startSurvey(eventId, organizationId, { actorType: "organizer", actorId: ownerId });
    const first = await runSurveyBatch(eventId, organizationId, 20);
    expect(first).toEqual({ sent: 2, failed: 0, remaining: 0, total: 2 });
    const again = await runSurveyBatch(eventId, organizationId, 20);
    expect(again.total).toBe(0);
    const logs = await prisma.emailLog.findMany({ where: { eventId, template: "event_survey" } });
    expect(logs.map((l) => l.toEmail).sort()).toEqual(
      [`x0-${suffix}@test.local`, `y0-${suffix}@test.local`].sort(),
    );
    expect(logs[0].previewText).toMatch(/\/bilan/);
  });
});

describe("learning from the surveys", () => {
  it("suggests raising the affinity of a pair that keeps producing deals, and applies it", async () => {
    const suggestions = await affinitySuggestions(organizationId);
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]).toMatchObject({ sample: 5, successRate: 1, current: 50, suggested: 60 });
    expect([suggestions[0].fromName, suggestions[0].toName].sort()).toEqual([
      "Garderie",
      "Traiteur",
    ]);

    await applyAffinity(organizationId, sectorA, sectorB, 60, { organizerId: ownerId });
    const row = await prisma.sectorAffinity.findFirst({ where: { organizationId } });
    expect(row?.score).toBe(60);
    const next = await affinitySuggestions(organizationId);
    expect(next[0]).toMatchObject({ current: 60, suggested: 70 });
    await expect(
      applyAffinity(organizationId, sectorA, sectorB, 150, { organizerId: ownerId }),
    ).rejects.toBeInstanceOf(AppError);
  });
});

describe("automatic retention", () => {
  it("notices inactive profiles, anonymizes 30 days later unless the person came back", async () => {
    const old = new Date();
    old.setMonth(old.getMonth() - 30);
    const [dormant, returning] = await Promise.all(
      ["dormant", "returning"].map((key) =>
        prisma.participant.create({
          data: {
            organizationId,
            email: `${key}-${suffix}@test.local`,
            firstName: key,
            lastName: "Test",
            companyName: `Cie ${key}`,
            offers: [],
            needs: [],
            createdAt: old,
            updatedAt: old,
          },
        }),
      ),
    );
    const now = new Date();
    const first = await runRetention(now);
    expect(first.noticed).toBe(2);
    expect(first.anonymized).toBe(0);
    const notices = await prisma.emailLog.count({
      where: { template: "retention_notice", toEmail: { in: [dormant.email, returning.email] } },
    });
    expect(notices).toBe(2);
    expect(
      (
        await prisma.emailLog.findFirst({
          where: { template: "retention_notice", toEmail: dormant.email },
        })
      )?.previewText,
    ).toMatch(/\/conserver/);

    await keepProfile(returning.id);
    const later = new Date(now.getTime() + 31 * 86_400_000);
    const second = await runRetention(later);
    expect(second.anonymized).toBe(1);
    const [gone, kept] = await Promise.all([
      prisma.participant.findUniqueOrThrow({ where: { id: dormant.id } }),
      prisma.participant.findUniqueOrThrow({ where: { id: returning.id } }),
    ]);
    expect(gone.deletedAt).not.toBeNull();
    expect(gone.email).toMatch(/@anonyme\.invalid$/);
    expect(kept.deletedAt).toBeNull();
    expect(kept.purgeNoticeSentAt).toBeNull();
  });
});
