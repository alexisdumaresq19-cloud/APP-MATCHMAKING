import { expect, test } from "@playwright/test";
import { DEMO_EVENT_PATH, clearRateLimits, participantToken, prisma, uniqueEmail } from "./helpers";

test.describe("Public registration and participant space", () => {
  test.beforeAll(async () => {
    await clearRateLimits();
  });

  test("a participant registers in three steps, receives a link and edits their profile", async ({
    page,
  }) => {
    const email = uniqueEmail();
    await page.goto(DEMO_EVENT_PATH);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Rencontres d'affaires");

    // Step 1 — Vous
    await page.getByLabel("Prénom").fill("Marie");
    await page.getByRole("textbox", { name: "Nom", exact: true }).fill("Tremblay");
    await page.getByLabel("Courriel").fill(email);
    await page.getByLabel("Téléphone").fill("514 555-0142");
    await page.getByRole("button", { name: "Continuer" }).click();

    // Step 2 — Votre entreprise
    await page.getByLabel("Nom de l'entreprise").fill("Garderie Les Petits Pas");
    await page
      .getByLabel("Secteur d'activité")
      .selectOption({ label: "Garderie / petite enfance" });
    await page.getByLabel("Région").selectOption("Montréal");
    await page.getByLabel("Ville").fill("Montréal");
    await page.getByLabel("Site web").fill("petitspas.ca");
    await page.getByRole("button", { name: "Continuer" }).click();

    // Step 3 — Votre jumelage
    const offers = page.getByLabel("Ce que vous offrez");
    await offers.fill("garde d'enfants");
    await offers.press("Enter");
    // The sectors that collaborate most with a daycare are pre-checked (affinity matrix ≥ 65).
    const sought = page.getByRole("group", { name: "Avec qui aimeriez-vous collaborer?" });
    await expect(sought.getByRole("checkbox", { name: /Ressources éducatives/ })).toBeChecked();
    await expect(
      sought.getByRole("checkbox", { name: /Entretien ménager et commercial/ }),
    ).toBeChecked();
    // The other sectors are folded away; one tap shows them all.
    await sought.getByRole("button", { name: /Voir les \d+ autres secteurs/ }).click();
    await expect(sought.getByRole("checkbox", { name: /^Juridique/ })).not.toBeChecked();
    await sought.getByRole("checkbox", { name: /^Juridique/ }).check();
    const needs = page.getByLabel("Ce que vous cherchez");
    await needs.fill("entretien ménager");
    await needs.press("Enter");
    await needs.fill("traiteur");
    await needs.press("Enter");

    // Submitting without consent must fail client-side.
    await page.getByRole("button", { name: "Confirmer mon inscription" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "accepter l'avis" })).toBeVisible();

    await page.getByLabel(/J'ai lu cet avis/).check();
    await page.waitForTimeout(3200); // anti-spam: minimum time on the form
    await page.getByRole("button", { name: "Confirmer mon inscription" }).click();

    await expect(page).toHaveURL(new RegExp(`${DEMO_EVENT_PATH}/merci$`));
    await expect(page.getByRole("heading", { name: "Merci!" })).toBeVisible();

    // Data was persisted with consent and normalized phone/website.
    const participant = await prisma.participant.findFirstOrThrow({
      where: { email },
      include: { registrations: true, consents: true, sector: true },
    });
    expect(participant.phone).toBe("+15145550142");
    expect(participant.website).toBe("https://petitspas.ca");
    expect(participant.offers).toEqual(["garde d'enfants"]);
    expect(participant.needs).toEqual(["entretien ménager", "traiteur"]);
    const soughtNames = (
      await prisma.sector.findMany({ where: { id: { in: participant.soughtSectorIds } } })
    )
      .map((s) => s.name)
      .sort();
    // The five pre-checked sectors of a daycare (guideline examples) plus the one added by hand.
    expect(soughtNames).toEqual(
      [
        "Animation et loisirs",
        "Entretien ménager et commercial",
        "Juridique",
        "Ressources éducatives",
        "Ressources humaines et formation",
        "Restauration et traiteur",
      ].sort(),
    );
    expect(participant.registrations).toHaveLength(1);
    expect(participant.consents).toHaveLength(1);
    const emailLog = await prisma.emailLog.findFirst({
      where: { toEmail: email, template: "registration_confirmed" },
    });
    expect(emailLog?.status).toBe("sent");

    // Participant space via the signed link.
    const token = await participantToken(participant);
    await page.goto(`/p/${token}`);
    await expect(page.getByRole("heading", { name: "Bonjour Marie" })).toBeVisible();
    await expect(page.getByText("Rencontres d'affaires")).toBeVisible();

    await page.goto(`/p/${token}/profil`);
    await page.getByLabel("Ville").fill("Laval");
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await expect(page.getByText("Votre profil a été enregistré.")).toBeVisible();
    const updated = await prisma.participant.findUniqueOrThrow({ where: { id: participant.id } });
    expect(updated.city).toBe("Laval");

    // Event page with calendar file.
    const eventId = participant.registrations[0].eventId;
    await page.goto(`/p/${token}/evenements/${eventId}`);
    await expect(page.getByRole("link", { name: "Ajouter à mon calendrier" })).toBeVisible();
    const ics = await page.request.get(`/p/${token}/evenements/${eventId}/calendrier.ics`);
    expect(ics.status()).toBe(200);
    expect(await ics.text()).toContain("BEGIN:VEVENT");
  });

  test("an expired link shows the recovery page", async ({ page }) => {
    await page.goto("/p/not-a-valid-token");
    await expect(page).toHaveURL(/\/p\/lien-expire$/);
    await expect(page.getByRole("heading", { name: "Ce lien n'est plus valide" })).toBeVisible();
  });

  test("registering with a known email shows the same success page and sends a link", async ({
    page,
  }) => {
    const existing = await prisma.participant.findFirstOrThrow({
      where: { organization: { slug: "demo" }, deletedAt: null },
      orderBy: { createdAt: "asc" },
    });
    await page.goto(DEMO_EVENT_PATH);
    await page.getByLabel("Prénom").fill("Quelqu'un");
    await page.getByRole("textbox", { name: "Nom", exact: true }).fill("Connu");
    await page.getByLabel("Courriel").fill(existing.email);
    await page.getByRole("button", { name: "Continuer" }).click();
    await page.getByLabel("Nom de l'entreprise").fill("Entreprise");
    await page.getByLabel("Secteur d'activité").selectOption({ index: 1 });
    await page.getByLabel("Région").selectOption("Laval");
    await page.getByLabel("Ville").fill("Laval");
    await page.getByRole("button", { name: "Continuer" }).click();
    const offers = page.getByLabel("Ce que vous offrez");
    await offers.fill("x");
    await offers.press("Enter");
    const needs = page.getByLabel("Ce que vous cherchez");
    await needs.fill("y");
    await needs.press("Enter");
    await page.getByLabel(/J'ai lu cet avis/).check();
    await page.waitForTimeout(3200);
    await page.getByRole("button", { name: "Confirmer mon inscription" }).click();
    await expect(page).toHaveURL(new RegExp(`${DEMO_EVENT_PATH}/merci$`));
    const log = await prisma.emailLog.findFirst({
      where: { toEmail: existing.email, template: "existing_profile_link" },
      orderBy: { createdAt: "desc" },
    });
    expect(log?.status).toBe("sent");
  });
});
