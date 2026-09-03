import { expect, test, type Page } from "@playwright/test";
import { OWNER, clearRateLimits, participantToken, prisma, uniqueEmail } from "./helpers";

/**
 * P2-S3 — after a completed event: the participant's « bilan » (D-38), the organizer's survey
 * run and summary, and the affinity suggestion applied in one click.
 */
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

const REASONS = {
  complementarity: {
    score: 70,
    aOffersBNeeds: [],
    bOffersANeeds: [],
    aSectorSoughtByB: true,
    bSectorSoughtByA: true,
  },
  sectorAffinity: { score: 80, sectors: ["Restauration et traiteur", "Garderie / petite enfance"] },
  region: { score: 100, same: true, neighbors: false, region: "Montréal" },
  novelty: { score: 100, previouslyMet: false },
  penalties: [],
};

async function login(page: Page) {
  await page.goto("/admin/login");
  await page.getByLabel("Courriel").first().fill(OWNER.email);
  await page.getByLabel("Mot de passe").fill(OWNER.password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

test.describe.configure({ mode: "serial" });

test.describe("Phase 2 — post-event survey and learning", () => {
  let organizationId: string;
  let eventId: string;
  let traiteurId: string;
  let garderieId: string;
  let originalAffinity = 0;
  const participantIds: string[] = [];
  const luc = { id: "", company: `Traiteur Luc ${suffix}`, email: uniqueEmail("luc") };
  const eva = { id: "", company: `Garderie Eva ${suffix}`, email: uniqueEmail("eva") };

  async function person(email: string, company: string, sectorId: string) {
    const organization = await prisma.organization.findUniqueOrThrow({ where: { slug: "demo" } });
    const row = await prisma.participant.create({
      data: {
        organizationId,
        email,
        firstName: company.split(" ")[1] ?? "Test",
        lastName: `Bilan-${suffix}`,
        companyName: company,
        sectorId,
        offers: ["service"],
        needs: ["clients"],
        consents: {
          create: {
            consentVersion: organization.consentVersion,
            consentText: organization.consentText,
          },
        },
      },
    });
    participantIds.push(row.id);
    return row;
  }

  async function matchPair(aParticipant: string, bParticipant: string) {
    const [ra, rb] = await Promise.all(
      [aParticipant, bParticipant].map((participantId) =>
        prisma.eventRegistration.create({
          data: {
            eventId,
            participantId,
            status: "CHECKED_IN",
            checkedInAt: new Date(),
            offersSnapshot: [],
            needsSnapshot: [],
          },
        }),
      ),
    );
    const [first, second] = ra.id < rb.id ? [ra, rb] : [rb, ra];
    return prisma.match.create({
      data: {
        eventId,
        aId: first.id,
        bId: second.id,
        score: 75,
        status: "PROPOSED",
        reasons: REASONS,
      },
    });
  }

  test.beforeAll(async () => {
    await clearRateLimits();
    const organization = await prisma.organization.findUniqueOrThrow({ where: { slug: "demo" } });
    organizationId = organization.id;
    const sectors = await prisma.sector.findMany({
      where: { organizationId, slug: { in: ["restauration-traiteur", "garderie-petite-enfance"] } },
    });
    traiteurId = sectors.find((s) => s.slug === "restauration-traiteur")!.id;
    garderieId = sectors.find((s) => s.slug === "garderie-petite-enfance")!.id;
    const [from, to] =
      traiteurId < garderieId ? [traiteurId, garderieId] : [garderieId, traiteurId];
    const affinity = await prisma.sectorAffinity.findFirst({
      where: { organizationId, fromSectorId: from, toSectorId: to },
    });
    originalAffinity = affinity?.score ?? 50;
    const event = await prisma.event.create({
      data: {
        organizationId,
        slug: `bilan-${suffix}`,
        name: `Soirée bilan ${suffix}`,
        startsAt: new Date(Date.now() - 2 * 86_400_000),
        status: "COMPLETED",
        publishedAt: new Date(Date.now() - 3 * 86_400_000),
        matchedAt: new Date(Date.now() - 3 * 86_400_000),
      },
    });
    eventId = event.id;
    const l = await person(luc.email, luc.company, traiteurId);
    const e = await person(eva.email, eva.company, garderieId);
    luc.id = l.id;
    eva.id = e.id;
    await matchPair(luc.id, eva.id);
    // Four more rated pairs between the same two sectors, so the suggestion reaches its sample.
    for (let i = 1; i <= 4; i += 1) {
      const a = await person(uniqueEmail(`t${i}`), `Traiteur ${i} ${suffix}`, traiteurId);
      const b = await person(uniqueEmail(`g${i}`), `Garderie ${i} ${suffix}`, garderieId);
      const match = await matchPair(a.id, b.id);
      await prisma.matchFeedback.create({
        data: { matchId: match.id, participantId: a.id, outcome: "DEAL" },
      });
    }
  });

  test.afterAll(async () => {
    const [from, to] =
      traiteurId < garderieId ? [traiteurId, garderieId] : [garderieId, traiteurId];
    // Only the project that applied the suggestion restores the shared matrix.
    if (test.info().project.name !== "mobile") {
      await prisma.sectorAffinity.updateMany({
        where: { organizationId, fromSectorId: from, toSectorId: to },
        data: { score: originalAffinity },
      });
    }
    await prisma.event.deleteMany({ where: { id: eventId } });
    await prisma.participant.deleteMany({ where: { id: { in: participantIds } } });
    await prisma.$disconnect();
  });

  test("a participant answers the survey from the event page", async ({ page }) => {
    const participant = await prisma.participant.findUniqueOrThrow({ where: { id: luc.id } });
    const token = await participantToken(participant);
    await page.goto(`/p/${token}/evenements/${eventId}`);
    await page.getByRole("link", { name: "Faire mon bilan" }).click();
    await expect(page.getByRole("heading", { name: "Mon bilan" })).toBeVisible();
    const block = page.locator("fieldset").filter({ hasText: eva.company });
    await block.getByLabel("Oui : une affaire ou un partenariat").check();
    await block.getByLabel(`Commentaire sur ${eva.company}`).fill("Contrat de traiteur signé!");
    await page.getByRole("button", { name: "Envoyer mon bilan" }).click();
    await expect(
      page.getByRole("status").filter({ hasText: /1 réponse enregistrée/ }),
    ).toBeVisible();
    const feedback = await prisma.matchFeedback.findFirst({ where: { participantId: luc.id } });
    expect(feedback?.outcome).toBe("DEAL");
    expect(feedback?.comment).toBe("Contrat de traiteur signé!");
  });

  test("the organizer sends the survey and reads the summary", async ({ page }) => {
    await login(page);
    await page.goto(`/admin/events/${eventId}/publication`);
    await page.getByRole("button", { name: /Envoyer le bilan/ }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Envoyer le bilan" }).click();
    await expect(page.getByText("Bilan envoyé")).toBeVisible({ timeout: 60_000 });
    await expect
      .poll(async () => prisma.emailLog.count({ where: { eventId, template: "event_survey" } }))
      .toBe(10);
    await page.reload();
    await expect(page.getByRole("heading", { name: "Bilan des rencontres" })).toBeVisible();
    await expect(page.getByText("Contrat de traiteur signé!")).toBeVisible();
  });

  test("the affinity matrix suggests raising a pair that keeps producing deals", async ({
    page,
    isMobile,
  }) => {
    test.skip(Boolean(isMobile), "Matrice partagée de l'organisation : un seul projet à la fois.");
    await login(page);
    await page.goto("/admin/settings/affinites");
    const row = page.getByRole("listitem").filter({
      hasText: /Restauration et traiteur ↔ Garderie|Garderie \/ petite enfance ↔ Restauration/,
    });
    await expect(row).toBeVisible();
    const target = Math.min(95, originalAffinity + 10);
    await row.getByRole("button", { name: `Passer à ${target}` }).click();
    await expect
      .poll(async () => {
        const [from, to] =
          traiteurId < garderieId ? [traiteurId, garderieId] : [garderieId, traiteurId];
        const affinity = await prisma.sectorAffinity.findFirst({
          where: { organizationId, fromSectorId: from, toSectorId: to },
        });
        return affinity?.score;
      })
      .toBe(target);
  });
});
