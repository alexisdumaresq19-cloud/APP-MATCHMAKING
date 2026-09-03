import { expect, test, type Page } from "@playwright/test";
import { OWNER, clearRateLimits, participantToken, prisma, uniqueEmail } from "./helpers";

/**
 * P2-S1 (D-36) — « Mon accès » by email, opt-in public directory with a company card that shows
 * nothing personal, and the admin CSV export.
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

test.describe("Phase 2 — company presence", () => {
  let participantId: string;
  const person = {
    firstName: "Lina",
    lastName: `Annuaire-${suffix}`,
    email: uniqueEmail("lina"),
    company: `Boulangerie Lina ${suffix}`,
  };

  test.beforeAll(async () => {
    await clearRateLimits();
    const organization = await prisma.organization.findUniqueOrThrow({ where: { slug: "demo" } });
    const sector = await prisma.sector.findFirstOrThrow({
      where: { organizationId: organization.id, slug: "restauration-traiteur" },
    });
    const participant = await prisma.participant.create({
      data: {
        organizationId: organization.id,
        email: person.email,
        firstName: person.firstName,
        lastName: person.lastName,
        phone: "+14185550177",
        companyName: person.company,
        sectorId: sector.id,
        city: "Gaspé",
        region: "Gaspésie–Îles-de-la-Madeleine",
        website: "https://boulangerie-lina.example",
        offers: ["pain au levain", "viennoiseries"],
        needs: ["cafés", "épiceries"],
        description: "Boulangerie artisanale.",
        consents: {
          create: {
            consentVersion: organization.consentVersion,
            consentText: organization.consentText,
          },
        },
      },
    });
    participantId = participant.id;
  });

  test.afterAll(async () => {
    await prisma.participant.deleteMany({ where: { id: participantId } });
    await prisma.$disconnect();
  });

  test("« Mon accès » sends the personal link by email", async ({ page }) => {
    await page.goto("/demo/connexion");
    await expect(page.getByRole("heading", { name: "Mon accès personnel" })).toBeVisible();
    await page.getByLabel(/Courriel/).fill(person.email);
    await page.getByRole("button", { name: /lien|Envoyer|Recevoir/ }).click();
    await expect(page.getByText(/lien vient d'être envoyé/)).toBeVisible();
    await expect
      .poll(async () =>
        prisma.emailLog.count({ where: { toEmail: person.email, template: "participant_link" } }),
      )
      .toBeGreaterThan(0);
  });

  test("a company opts into the public directory and gets a card without personal data", async ({
    page,
  }) => {
    const participant = await prisma.participant.findUniqueOrThrow({
      where: { id: participantId },
    });
    const token = await participantToken(participant);

    // Not listed yet: absent from the public directory.
    await page.goto(`/demo/entreprises?q=${encodeURIComponent(person.company)}`);
    await expect(page.getByText("Aucune entreprise ne correspond")).toBeVisible();

    await page.goto(`/p/${token}/profil`);
    await page.getByRole("button", { name: "Afficher mon entreprise dans l'annuaire" }).click();
    await expect(
      page.getByRole("button", { name: "Retirer mon entreprise de l'annuaire" }),
    ).toBeVisible();
    await expect
      .poll(async () => {
        const row = await prisma.participant.findUniqueOrThrow({ where: { id: participantId } });
        return row.directoryOptIn;
      })
      .toBe(true);

    await page.goto(`/demo/entreprises?q=${encodeURIComponent(person.company)}`);
    await page.getByRole("link", { name: new RegExp(person.company) }).click();
    await expect(page).toHaveURL(new RegExp(`/demo/entreprises/${participantId}$`));
    await expect(page.getByRole("heading", { name: person.company })).toBeVisible();
    await expect(page.getByText("pain au levain")).toBeVisible();
    await expect(page.getByText("Restauration et traiteur")).toBeVisible();
    await expect(page.getByText(person.lastName)).toHaveCount(0);
    await expect(page.getByText(person.email)).toHaveCount(0);
    await expect(page.getByText("555")).toHaveCount(0);
  });

  test("the organizer exports the directory as CSV with the public-directory column", async ({
    page,
  }) => {
    await login(page);
    const response = await page.request.get(
      `/admin/participants/export.csv?q=${encodeURIComponent(person.lastName)}`,
    );
    expect(response.ok()).toBeTruthy();
    expect(response.headers()["content-type"]).toContain("text/csv");
    const csv = await response.text();
    expect(csv).toContain("Annuaire public");
    expect(csv).toContain(person.company);
    expect(csv).toContain("Oui");
  });
});
