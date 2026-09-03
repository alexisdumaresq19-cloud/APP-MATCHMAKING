import { expect, test } from "@playwright/test";
import { clearRateLimits, participantToken, prisma, uniqueEmail } from "./helpers";

/**
 * P2-S2 (D-37) — after a match: « Ajouter à mes contacts » and « Message », the thread with its
 * email notification and unread badge, closing a conversation, the address book and its export,
 * and the directory rule (both companies listed).
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

test.describe.configure({ mode: "serial" });

test.describe("Phase 2 — messaging and contacts", () => {
  let organizationId: string;
  let eventId: string;
  let conversationId = "";
  const people = {
    marc: { id: "", company: `Traiteur Marc ${suffix}`, email: uniqueEmail("marc") },
    sofia: { id: "", company: `Garderie Sofia ${suffix}`, email: uniqueEmail("sofia") },
    listed: { id: "", company: `Imprimerie Listée ${suffix}`, email: uniqueEmail("listed") },
  };

  test.beforeAll(async () => {
    await clearRateLimits();
    const organization = await prisma.organization.findUniqueOrThrow({ where: { slug: "demo" } });
    organizationId = organization.id;
    const sector = await prisma.sector.findFirstOrThrow({
      where: { organizationId, slug: "restauration-traiteur" },
    });
    const event = await prisma.event.create({
      data: {
        organizationId,
        slug: `messagerie-${suffix}`,
        name: `Soirée messagerie ${suffix}`,
        startsAt: new Date(Date.now() + 3 * 86_400_000),
        status: "PUBLISHED",
        publishedAt: new Date(),
        matchedAt: new Date(),
      },
    });
    eventId = event.id;
    for (const [key, person] of Object.entries(people)) {
      const row = await prisma.participant.create({
        data: {
          organizationId,
          email: person.email,
          firstName: key[0].toUpperCase() + key.slice(1),
          lastName: `Messagerie-${suffix}`,
          companyName: person.company,
          sectorId: sector.id,
          offers: ["service"],
          needs: ["clients"],
          directoryOptIn: key === "listed",
          directoryOptInAt: key === "listed" ? new Date() : null,
          consents: {
            create: {
              consentVersion: organization.consentVersion,
              consentText: organization.consentText,
            },
          },
        },
      });
      person.id = row.id;
    }
    const [ra, rb] = await Promise.all(
      [people.marc.id, people.sofia.id].map((participantId) =>
        prisma.eventRegistration.create({
          data: {
            eventId,
            participantId,
            status: "CONFIRMED",
            offersSnapshot: [],
            needsSnapshot: [],
          },
        }),
      ),
    );
    const [first, second] = ra.id < rb.id ? [ra, rb] : [rb, ra];
    await prisma.match.create({
      data: {
        eventId,
        aId: first.id,
        bId: second.id,
        score: 77,
        status: "PROPOSED",
        reasons: REASONS,
      },
    });
  });

  test.afterAll(async () => {
    await prisma.event.deleteMany({ where: { id: eventId } });
    await prisma.participant.deleteMany({
      where: { id: { in: Object.values(people).map((p) => p.id) } },
    });
    await prisma.$disconnect();
  });

  test("from a match card: add to contacts, then write the first message", async ({ page }) => {
    const marc = await prisma.participant.findUniqueOrThrow({ where: { id: people.marc.id } });
    const token = await participantToken(marc);
    await page.goto(`/p/${token}/evenements/${eventId}`);
    const card = page.getByRole("listitem").filter({ hasText: people.sofia.company });
    await card.getByRole("button", { name: "Ajouter à mes contacts" }).click();
    await expect(card.getByRole("button", { name: /Dans mes contacts/ })).toBeVisible();
    await card.getByRole("button", { name: "Message" }).click();
    await expect(page).toHaveURL(new RegExp(`/p/${token}/messages/[a-z0-9]+$`));
    conversationId = page.url().split("/").pop()!;
    await expect(page.getByRole("heading", { name: people.sofia.company })).toBeVisible();
    await page.getByLabel(/Votre message à/).fill("Bonjour Sofia, on se voit à la table 4?");
    await page.getByRole("button", { name: "Envoyer" }).click();
    await expect(page.getByText("Bonjour Sofia, on se voit à la table 4?")).toBeVisible();
    await expect
      .poll(async () =>
        prisma.emailLog.count({
          where: { toEmail: people.sofia.email, template: "message_received" },
        }),
      )
      .toBe(1);
  });

  test("the recipient sees the unread badge, reads and replies", async ({ page }) => {
    const sofia = await prisma.participant.findUniqueOrThrow({ where: { id: people.sofia.id } });
    const token = await participantToken(sofia);
    await page.goto(`/p/${token}`);
    await expect(page.getByRole("link", { name: /Messages/ })).toContainText("1");
    await page.getByRole("link", { name: /Messages/ }).click();
    const row = page.getByRole("link", { name: new RegExp(people.marc.company) });
    await expect(row).toBeVisible();
    await row.click();
    await expect(page.getByText("Bonjour Sofia, on se voit à la table 4?")).toBeVisible();
    await page.getByLabel(/Votre message à/).fill("Avec plaisir, à jeudi!");
    await page.getByRole("button", { name: "Envoyer" }).click();
    await expect(page.getByText("Avec plaisir, à jeudi!")).toBeVisible();
    expect(
      await prisma.message.count({
        where: { conversationId, readAt: null, senderId: people.marc.id },
      }),
    ).toBe(0);
  });

  test("contacts page with a note and CSV export; closing a conversation stops replies", async ({
    page,
  }) => {
    const marc = await prisma.participant.findUniqueOrThrow({ where: { id: people.marc.id } });
    const token = await participantToken(marc);
    await page.goto(`/p/${token}/contacts`);
    await expect(page.getByText(people.sofia.company)).toBeVisible();
    await page.getByLabel(/Ma note/).fill("Rencontrée à la soirée, rappeler en octobre");
    await page.getByRole("button", { name: "Enregistrer la note" }).click();
    await expect(page.getByText("Note enregistrée.")).toBeVisible();
    const csv = await page.request.get(`/p/${token}/contacts/export.csv`);
    expect(await csv.text()).toContain("rappeler en octobre");

    const sofia = await prisma.participant.findUniqueOrThrow({ where: { id: people.sofia.id } });
    const sofiaToken = await participantToken(sofia);
    await page.goto(`/p/${sofiaToken}/messages/${conversationId}`);
    await page.getByRole("button", { name: "Fermer la conversation" }).click();
    await expect(page.getByText(/Vous avez fermé cette conversation/)).toBeVisible();
    await page.goto(`/p/${token}/messages/${conversationId}`);
    await expect(page.getByText("Cette entreprise a fermé la conversation.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Envoyer" })).toHaveCount(0);
  });

  test("directory: « Message » only when both companies are listed", async ({ page }) => {
    const marc = await prisma.participant.findUniqueOrThrow({ where: { id: people.marc.id } });
    const token = await participantToken(marc);
    await page.goto(`/p/${token}/entreprises?q=${encodeURIComponent(people.listed.company)}`);
    const card = page.getByRole("listitem").filter({ hasText: people.listed.company });
    await expect(card.getByRole("button", { name: "Ajouter à mes contacts" })).toBeVisible();
    await expect(card.getByRole("button", { name: "Message" })).toHaveCount(0);
    await expect(page.getByText(/affichez la vôtre aussi/)).toBeVisible();

    await prisma.participant.update({
      where: { id: people.marc.id },
      data: { directoryOptIn: true, directoryOptInAt: new Date() },
    });
    await page.reload();
    await card.getByRole("button", { name: "Message" }).click();
    await expect(page).toHaveURL(new RegExp(`/p/${token}/messages/[a-z0-9]+$`));
    await expect(page.getByRole("heading", { name: people.listed.company })).toBeVisible();
  });
});
