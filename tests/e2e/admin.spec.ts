import { expect, test } from "@playwright/test";
import { OWNER, clearRateLimits } from "./helpers";

test.describe("Organizer", () => {
  test.beforeAll(async () => {
    await clearRateLimits();
  });

  test("redirects anonymous visitors to the login page", async ({ page }) => {
    await page.goto("/admin/events");
    await expect(page).toHaveURL(/\/admin\/login\?callbackUrl=/);
  });

  test("rejects a wrong password", async ({ page }) => {
    await page.goto("/admin/login");
    await page.getByLabel("Courriel").first().fill(OWNER.email);
    await page.getByLabel("Mot de passe").fill("mauvais-mot-de-passe");
    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect(page.getByText("Courriel ou mot de passe incorrect.")).toBeVisible();
  });

  test("logs in, sees the dashboard and the registrants of the open event", async ({ page }) => {
    await page.goto("/admin/login");
    await page.getByLabel("Courriel").first().fill(OWNER.email);
    await page.getByLabel("Mot de passe").fill(OWNER.password);
    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole("heading", { name: /Bonjour/ })).toBeVisible();

    await page.getByRole("link", { name: "Événements" }).first().click();
    await expect(page).toHaveURL(/\/admin\/events/);
    await page
      .getByRole("link", { name: /Rencontres d'affaires/ })
      .first()
      .click();
    await expect(page).toHaveURL(/\/admin\/events\/[^/]+\/details$/);
    await expect(page.getByLabel("Nom de l'événement")).toHaveValue(/Rencontres d'affaires/);

    await page.getByRole("link", { name: "Inscrits" }).click();
    await expect(page).toHaveURL(/\/inscrits$/);
    await expect(page.getByText(/inscrits? actifs?/)).toBeVisible();
    const rows = page.getByRole("row");
    expect(await rows.count()).toBeGreaterThan(5);

    // Open the first registrant drawer and check the profile form is there.
    await page.getByRole("button", { name: "Ouvrir" }).first().click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("dialog").getByLabel("Nom de l'entreprise")).toBeVisible();
  });
});
