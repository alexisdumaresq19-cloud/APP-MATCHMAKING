import { expect, test, type Page } from "@playwright/test";
import { OWNER, clearRateLimits, participantToken, prisma, uniqueEmail } from "./helpers";

/**
 * S3-09 — the whole Phase 1 journey on a dedicated event: public registration → matching → tables
 * → publication (emails) → participant view → check-in → closing with the billing snapshot.
 */
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

async function login(page: Page) {
  await page.goto("/admin/login");
  await page.getByLabel("Courriel").first().fill(OWNER.email);
  await page.getByLabel("Mot de passe").fill(OWNER.password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

test.describe.configure({ mode: "serial" });

test.describe("Week 3 — end-to-end journey", () => {
  let eventId: string;
  let organizationId: string;
  const walkIn = { firstName: "Léa", lastName: `Sur-Place-${suffix}` };
  const visitor = {
    firstName: "Marie",
    lastName: `Parcours-${suffix}`,
    email: uniqueEmail("journey"),
  };

  test.beforeAll(async () => {
    await clearRateLimits();
    const organization = await prisma.organization.findUniqueOrThrow({ where: { slug: "demo" } });
    organizationId = organization.id;
    const sectors = await prisma.sector.findMany({
      where: {
        organizationId,
        slug: {
          in: ["garderie-petite-enfance", "entretien-menager-commercial", "ressources-educatives"],
        },
      },
    });
    const bySlug = new Map(sectors.map((s) => [s.slug, s]));
    const event = await prisma.event.create({
      data: {
        organizationId,
        slug: `parcours-${suffix}`,
        name: `Parcours complet ${suffix}`,
        startsAt: new Date(Date.now() + 2 * 86_400_000),
        endsAt: new Date(Date.now() + 2 * 86_400_000 + 3 * 3_600_000),
        venueName: "Salle des tests",
        capacity: 20,
        status: "OPEN",
        tableCount: 2,
        seatsPerTable: 4,
        roundCount: 2,
        roundMinutes: 20,
        matchesPerParticipant: 3,
      },
    });
    eventId = event.id;
    // Three consented registrants seeded directly, so the matching has candidates.
    const seeds = [
      {
        first: "Pierre",
        slug: "entretien-menager-commercial",
        offers: ["entretien ménager"],
        needs: ["garderies"],
      },
      {
        first: "Julie",
        slug: "ressources-educatives",
        offers: ["ressources éducatives"],
        needs: ["garde d'enfants"],
      },
      {
        first: "Marc",
        slug: "garderie-petite-enfance",
        offers: ["garde d'enfants"],
        needs: ["traiteur"],
      },
    ];
    for (const seed of seeds) {
      const participant = await prisma.participant.create({
        data: {
          organizationId,
          email: uniqueEmail(seed.first.toLowerCase()),
          firstName: seed.first,
          lastName: `Semé-${suffix}`,
          companyName: `${seed.first} inc.`,
          sectorId: bySlug.get(seed.slug)?.id,
          region: "Montréal",
          city: "Montréal",
          offers: seed.offers,
          needs: seed.needs,
          consentedAt: new Date(),
          consents: {
            create: {
              consentVersion: organization.consentVersion,
              consentText: organization.consentText,
              eventId,
            },
          },
        },
      });
      await prisma.eventRegistration.create({
        data: {
          eventId,
          participantId: participant.id,
          status: "CONFIRMED",
          offersSnapshot: seed.offers,
          needsSnapshot: seed.needs,
        },
      });
    }
  });

  test.afterAll(async () => {
    await prisma.event.deleteMany({ where: { id: eventId } });
  });

  test("a visitor registers on the public page", async ({ page }) => {
    await page.goto(`/e/demo/parcours-${suffix}`);
    await page.getByRole("textbox", { name: "Prénom", exact: true }).fill(visitor.firstName);
    await page.getByRole("textbox", { name: "Nom", exact: true }).fill(visitor.lastName);
    await page.getByRole("textbox", { name: "Courriel", exact: true }).fill(visitor.email);
    await page.getByRole("button", { name: "Continuer" }).click();
    await page.getByLabel("Nom de l'entreprise").fill("Garderie du Parcours");
    await page
      .getByLabel("Secteur d'activité")
      .selectOption({ label: "Garderie / petite enfance" });
    await page.getByLabel("Région").selectOption("Montréal");
    await page.getByLabel("Ville").fill("Montréal");
    await page.getByRole("button", { name: "Continuer" }).click();
    const offers = page.getByLabel("Ce que vous offrez");
    await offers.fill("garde d'enfants");
    await offers.press("Enter");
    await page.waitForTimeout(3200); // anti-spam minimum form time
    await page.getByLabel(/J'ai lu cet avis/).check();
    await page.getByRole("button", { name: "Confirmer mon inscription" }).click();
    await expect(page.getByRole("heading", { name: "Merci!" })).toBeVisible();
    const registrations = await prisma.eventRegistration.count({
      where: { eventId, status: { not: "CANCELLED" } },
    });
    expect(registrations).toBe(4);
  });

  test("the organizer runs the matching, seats everyone and exports the plan", async ({ page }) => {
    await login(page);
    await page.goto(`/admin/events/${eventId}/matching`);
    await page.getByRole("button", { name: /Lancer le matching/ }).click();
    await expect(page.getByText(/jumelages calculés/)).toBeVisible({ timeout: 60_000 });
    expect(await prisma.match.count({ where: { eventId } })).toBeGreaterThan(0);

    await page.goto(`/admin/events/${eventId}/tables`);
    await page.getByRole("button", { name: "Placer automatiquement" }).click();
    await expect(page.getByText(/Placement terminé :/)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("Tout le monde a une place").first()).toBeVisible();
    const seats = await prisma.tableAssignment.count({ where: { registration: { eventId } } });
    expect(seats).toBe(8); // 4 people × 2 rounds

    // A manual lock survives an automatic re-seat.
    const lockButton = page.getByRole("button", { name: /^Verrouiller / }).first();
    const lockedName = (await lockButton.getAttribute("aria-label"))!.replace("Verrouiller ", "");
    await lockButton.click();
    await expect(page.getByRole("button", { name: `Déverrouiller ${lockedName}` })).toBeVisible();
    await expect
      .poll(async () =>
        prisma.tableAssignment.count({ where: { registration: { eventId }, isLocked: true } }),
      )
      .toBe(1);

    // Round 2 is reachable and the exports answer.
    await page.goto(`/admin/events/${eventId}/tables?ronde=2`);
    await expect(page.getByText("Ronde 2 de 2")).toBeVisible();
    const workbook = await page.request.get(`/admin/events/${eventId}/tables/export.xlsx`);
    expect(workbook.status()).toBe(200);
    expect(workbook.headers()["content-type"]).toContain("spreadsheetml");
    await page.goto(`/admin/events/${eventId}/tables/imprimer`);
    await expect(page.getByRole("heading", { name: "Plan de tables" })).toBeVisible();
    await expect(page.getByText("Table 1").first()).toBeVisible();
  });

  test("publishing sends the emails in batches and the participant sees matches and table", async ({
    page,
  }) => {
    await login(page);
    await page.goto(`/admin/events/${eventId}/publication`);
    await page.getByRole("button", { name: /Publier les jumelages/ }).click();
    await page.getByRole("button", { name: "Publier et envoyer" }).click();
    await expect(page.getByText("Jumelages envoyés")).toBeVisible({ timeout: 60_000 });
    const event = await prisma.event.findUniqueOrThrow({ where: { id: eventId } });
    expect(event.status).toBe("PUBLISHED");
    expect(event.publishedAt).not.toBeNull();
    const sent = await prisma.emailLog.count({
      where: { eventId, template: "matches_published", status: "sent" },
    });
    expect(sent).toBe(4);
    const stamped = await prisma.eventRegistration.count({
      where: { eventId, publishedMatchesHash: { not: null } },
    });
    expect(stamped).toBe(4);

    // Nothing changed: republishing has nothing to send.
    await page.reload();
    await expect(page.getByText("0 courriel à envoyer")).toBeVisible();

    // The participant's space shows the table and the matches, without contact details yet.
    const participant = await prisma.participant.findFirstOrThrow({
      where: { email: visitor.email },
    });
    const token = await participantToken(participant);
    await page.goto(`/p/${token}/evenements/${eventId}`);
    await expect(page.getByRole("heading", { name: "Ma table" })).toBeVisible();
    await expect(page.getByText(/Ronde 1 · /)).toBeVisible();
    await expect(page.getByRole("heading", { name: /Mes jumelages/ })).toBeVisible();
    await expect(page.getByText("Pourquoi vous").first()).toBeVisible();
    await expect(page.locator('a[href^="mailto:"]')).toHaveCount(0);
  });

  test("day of: check-in, a walk-in, then closing the event freezes billing", async ({ page }) => {
    await login(page);
    await page.goto(`/admin/events/${eventId}/jour-j`);
    const name = `${visitor.firstName} ${visitor.lastName}`;
    await page.getByLabel("Rechercher un inscrit").fill(visitor.lastName);
    await page.getByRole("button", { name: `Marquer ${name} présent` }).click();
    await expect(
      page.getByRole("button", { name: `Annuler la présence de ${name}` }),
    ).toBeVisible();
    await expect
      .poll(
        async () =>
          (
            await prisma.eventRegistration.findFirstOrThrow({
              where: { eventId, participant: { email: visitor.email } },
            })
          ).status,
      )
      .toBe("CHECKED_IN");

    await page.getByRole("button", { name: "Ajouter sur place" }).click();
    const sheet = page.getByRole("dialog");
    await sheet.getByRole("textbox", { name: "Prénom", exact: true }).fill(walkIn.firstName);
    await sheet.getByRole("textbox", { name: "Nom", exact: true }).fill(walkIn.lastName);
    await sheet.getByRole("textbox", { name: "Courriel", exact: true }).fill(uniqueEmail("walkin"));
    await sheet.getByRole("textbox", { name: "Entreprise", exact: true }).fill("Arrivée surprise");
    await sheet.getByRole("button", { name: "Ajouter et marquer présent" }).click();
    await expect(page.getByText(/est inscrit et présent/)).toBeVisible();
    await expect(page.getByText(`${walkIn.firstName} ${walkIn.lastName}`)).toBeVisible();

    // Kiosk mode works with the same data.
    await page.goto(`/admin/events/${eventId}/jour-j/plein-ecran`);
    await expect(page.getByRole("heading", { name: `Parcours complet ${suffix}` })).toBeVisible();
    await expect(page.getByText("/ 5 présents")).toBeVisible();

    await page.goto(`/admin/events/${eventId}/jour-j`);
    await page.getByRole("button", { name: "Terminer l'événement" }).click();
    await page.getByRole("button", { name: "Terminer et figer la facturation" }).click();
    await expect(page.getByText(/Événement terminé : 2 présents, 3 absents/)).toBeVisible();

    const event = await prisma.event.findUniqueOrThrow({ where: { id: eventId } });
    expect(event.status).toBe("COMPLETED");
    const snapshot = await prisma.billingSnapshot.findUniqueOrThrow({ where: { eventId } });
    expect(snapshot).toMatchObject({
      totalRegistered: 5,
      totalCheckedIn: 2,
      totalPlatformSource: 4,
      totalManualSource: 1,
    });
    expect(await prisma.eventRegistration.count({ where: { eventId, status: "NO_SHOW" } })).toBe(3);
  });
});
