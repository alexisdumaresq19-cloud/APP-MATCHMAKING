import { expect, test, type Page } from "@playwright/test";
import { OWNER, clearRateLimits, prisma } from "./helpers";

async function login(page: Page) {
  await page.goto("/admin/login");
  await page.getByLabel("Courriel").first().fill(OWNER.email);
  await page.getByLabel("Mot de passe").fill(OWNER.password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

async function openEventId(): Promise<string> {
  const event = await prisma.event.findFirstOrThrow({ where: { slug: "rencontres-affaires-printemps", organization: { slug: "demo" } } });
  return event.id;
}

test.describe("Week 2 — matching, settings, import/export", () => {
  test.beforeAll(async () => {
    await clearRateLimits();
  });

  test("runs the matching and shows readable reasons, pin and exclude", async ({ page }) => {
    await login(page);
    const eventId = await openEventId();
    await page.goto(`/admin/events/${eventId}/matching`);
    await expect(page.getByText("Inscrits éligibles")).toBeVisible();
    await page.getByRole("button", { name: /Lancer le matching|Recalculer le matching/ }).click();
    await expect(page.getByText(/jumelages calculés/)).toBeVisible({ timeout: 60_000 });
    const firstCard = page.locator("article").first();
    await expect(firstCard.getByRole("button", { name: "Épingler" }).first()).toBeVisible();
    await firstCard.getByRole("button", { name: "Épingler" }).first().click();
    await expect(page.getByText("Jumelage épinglé.")).toBeVisible();
    await expect(firstCard.getByText("Épinglé").first()).toBeVisible();
    await firstCard.getByRole("button", { name: "Désépingler" }).first().click();
    await expect(page.getByText("Statut réinitialisé.")).toBeVisible();
    const pinned = await prisma.match.count({ where: { eventId, status: "PINNED" } });
    expect(pinned).toBe(0);
  });

  test("settings: sectors, affinity matrix and rule sets render and save", async ({ page }) => {
    await login(page);
    await page.goto("/admin/settings/secteurs");
    await expect(page.getByRole("heading", { name: "Secteurs d'activité" })).toBeVisible();
    await expect(page.getByText("Garderie / petite enfance")).toBeVisible();

    await page.goto("/admin/settings/affinites");
    await expect(page.getByRole("heading", { name: /Matrice d'affinité/ })).toBeVisible();
    const cell = page.getByLabel("Garderie / petite enfance et Entretien ménager et commercial").first();
    await expect(cell).toHaveValue("85");

    await page.goto("/admin/settings/regles");
    await expect(page.getByRole("heading", { name: "Règles par défaut" })).toBeVisible();
    await page.getByRole("button", { name: "Enregistrer les règles" }).click();
    await expect(page.getByText("Règles enregistrées.")).toBeVisible();
  });

  test("exports the registrants as CSV and serves the import template", async ({ page }) => {
    await login(page);
    const eventId = await openEventId();
    const csv = await page.request.get(`/admin/events/${eventId}/inscrits/export.csv`);
    expect(csv.status()).toBe(200);
    const text = await csv.text();
    expect(text).toContain("Prénom;Nom;Courriel");
    expect(text.split("\r\n").length).toBeGreaterThan(50);
    const xlsx = await page.request.get(`/admin/events/${eventId}/inscrits/export.xlsx`);
    expect(xlsx.status()).toBe(200);
    expect(xlsx.headers()["content-type"]).toContain("spreadsheetml");
    const template = await page.request.get(`/admin/events/${eventId}/inscrits/import/modele.csv`);
    expect(await template.text()).toContain("courriel;prenom;nom");
  });

  test("adds a registrant manually with consent pending", async ({ page }) => {
    await login(page);
    const eventId = await openEventId();
    const email = `manuel-${Date.now()}@exemple.quebec`;
    await page.goto(`/admin/events/${eventId}/inscrits`);
    await page.getByRole("button", { name: "Ajouter un inscrit" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("textbox", { name: "Courriel", exact: true }).fill(email);
    await dialog.getByRole("textbox", { name: "Prénom", exact: true }).fill("Manuel");
    await dialog.getByRole("textbox", { name: "Nom", exact: true }).fill("Ajouté");
    await dialog.getByRole("textbox", { name: "Entreprise", exact: true }).fill("Entreprise Manuelle");
    await dialog.getByRole("combobox", { name: "Secteur", exact: true }).selectOption({ index: 1 });
    await dialog.getByRole("combobox", { name: "Région", exact: true }).selectOption("Laval");
    await dialog.getByRole("textbox", { name: "Ville", exact: true }).fill("Laval");
    const offers = dialog.getByLabel("Ce que l'entreprise offre");
    await offers.fill("consultation");
    await offers.press("Enter");
    const needs = dialog.getByLabel("Ce que l'entreprise cherche");
    await needs.fill("marketing");
    await needs.press("Enter");
    await dialog.getByRole("button", { name: "Ajouter l'inscrit" }).click();
    await expect(page.getByText(/Inscrit ajouté/)).toBeVisible();
    const participant = await prisma.participant.findFirstOrThrow({ where: { email }, include: { registrations: true } });
    expect(participant.registrations[0]?.source).toBe("MANUAL");
    expect(participant.consentedAt).toBeNull();
    const log = await prisma.emailLog.findFirst({ where: { toEmail: email, template: "consent_pending" } });
    expect(log?.status).toBe("sent");
  });
});
