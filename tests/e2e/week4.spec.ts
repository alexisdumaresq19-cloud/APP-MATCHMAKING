import { expect, test, type Page } from "@playwright/test";
import { OWNER, clearRateLimits, participantToken, prisma, uniqueEmail } from "./helpers";

/**
 * S4 — settings (organisation, logo, consent versions), accounts (invitation flow through the
 * test mailbox), the participants directory and the Law 25 self-service → admin queue.
 */
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
const inviteeEmail = `invitee-${suffix}@exemple.quebec`;
const inviteePassword = `Invitee-${suffix}-Ok!`;
const PNG_HEADER = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

async function login(page: Page, email = OWNER.email, password = OWNER.password) {
  await page.goto("/admin/login");
  await page.getByLabel("Courriel").first().fill(email);
  await page.getByLabel("Mot de passe").fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

test.describe.configure({ mode: "serial" });

test.describe("Week 4 — settings, accounts, directory, Law 25", () => {
  let organizationId: string;
  let participantId: string;
  let initialConsent: { text: string; version: string };
  const person = { firstName: "Zoé", lastName: `Annuaire-${suffix}`, email: uniqueEmail("zoe") };

  test.beforeAll(async () => {
    await clearRateLimits();
    const organization = await prisma.organization.findUniqueOrThrow({ where: { slug: "demo" } });
    organizationId = organization.id;
    initialConsent = { text: organization.consentText, version: organization.consentVersion };
    const participant = await prisma.participant.create({
      data: {
        organizationId,
        email: person.email,
        firstName: person.firstName,
        lastName: person.lastName,
        companyName: "Boulangerie Zoé",
        phone: "+14185550199",
        offers: ["pain frais"],
        needs: ["clients corporatifs"],
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
    await prisma.organization.update({
      where: { id: organizationId },
      data: {
        replyToEmail: "bonjour@demo.local",
        logoData: null,
        logoMimeType: null,
        logoUrl: null,
        consentText: initialConsent.text,
        consentVersion: initialConsent.version,
      },
    });
    await prisma.organizer.deleteMany({ where: { organizationId, email: inviteeEmail } });
    await prisma.$disconnect();
  });

  test("organisation: settings saved, logo sniffed, SVG refused", async ({ page, isMobile }) => {
    test.skip(Boolean(isMobile), "Réglages partagés de l'organisation : un seul projet à la fois.");
    await login(page);
    await page.goto("/admin/settings/organisation");
    const settingsForm = page
      .locator("form")
      .filter({ has: page.getByLabel("Courriel de réponse") });
    await settingsForm.getByLabel("Courriel de réponse").fill(`reponse-${suffix}@demo.local`);
    await settingsForm.getByRole("button", { name: /Enregistrer/ }).click();
    await expect
      .poll(async () => {
        const org = await prisma.organization.findUniqueOrThrow({ where: { id: organizationId } });
        return org.replyToEmail;
      })
      .toBe(`reponse-${suffix}@demo.local`);

    const png = Buffer.alloc(64);
    Buffer.from(PNG_HEADER).copy(png);
    await page
      .getByLabel("Fichier du logo")
      .setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: png });
    await page.getByRole("button", { name: "Enregistrer le logo" }).click();
    await expect
      .poll(async () => {
        const org = await prisma.organization.findUniqueOrThrow({ where: { id: organizationId } });
        return org.logoMimeType;
      })
      .toBe("image/png");
    const served = await page.request.get("/demo/logo");
    expect(served.status()).toBe(200);
    expect(served.headers()["content-type"]).toContain("image/png");

    // A file named .png but carrying SVG is refused: the server sniffs the bytes.
    await page.getByLabel("Fichier du logo").setInputFiles({
      name: "fake.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
      ),
    });
    await page.getByRole("button", { name: "Enregistrer le logo" }).click();
    await expect(page.getByText(/PNG, JPEG ou WebP/).first()).toBeVisible();

    await page.getByRole("button", { name: "Retirer le logo" }).click();
    await expect
      .poll(async () => {
        const org = await prisma.organization.findUniqueOrThrow({ where: { id: organizationId } });
        return org.logoMimeType;
      })
      .toBeNull();
  });

  test("consent: a new version is adopted, kept in history and restorable", async ({
    page,
    isMobile,
  }) => {
    test.skip(Boolean(isMobile), "Réglages partagés de l'organisation : un seul projet à la fois.");
    await login(page);
    await page.goto("/admin/settings/consentement");
    const textarea = page.getByLabel("Avis de collecte de renseignements personnels");
    const original = (await textarea.inputValue()).trim();
    const currentText = async () => {
      const org = await prisma.organization.findUniqueOrThrow({ where: { id: organizationId } });
      return org.consentText.replace(/\r\n?/g, "\n").trim();
    };

    // Version A, then version B: two adoptions, two history rows, B in force.
    const textA = `${original}\n\nVersion A ${suffix}.`;
    await textarea.fill(textA);
    await page.getByLabel("Note pour l'historique").fill(`Note A ${suffix}`);
    await page.getByRole("button", { name: "Adopter cette version" }).click();
    await expect(page.getByText(`Note A ${suffix}`)).toBeVisible();
    await expect.poll(currentText).toBe(textA);

    await textarea.fill(`${original}\n\nVersion B ${suffix}.`);
    await page.getByLabel("Note pour l'historique").fill(`Note B ${suffix}`);
    await page.getByRole("button", { name: "Adopter cette version" }).click();
    await expect(page.getByText(`Note B ${suffix}`)).toBeVisible();
    await expect.poll(currentText).toBe(`${original}\n\nVersion B ${suffix}.`);

    // Restoring A from its history row makes it the notice in force again.
    await page
      .getByRole("listitem")
      .filter({ hasText: `Note A ${suffix}` })
      .getByRole("button", { name: /Restaurer/ })
      .click();
    await expect.poll(currentText).toBe(textA);
    await expect(
      page
        .getByRole("listitem")
        .filter({ hasText: `Note A ${suffix}` })
        .getByText("Version en vigueur"),
    ).toBeVisible();
    expect(
      await prisma.consentTextVersion.count({ where: { organizationId } }),
    ).toBeGreaterThanOrEqual(3);
  });

  test("accounts: invitation email → activation page → first sign-in", async ({
    page,
    browser,
  }) => {
    await login(page);
    await page.goto("/admin/settings/comptes");
    await page.getByRole("button", { name: "Inviter une personne" }).click();
    const sheet = page.getByRole("dialog");
    await sheet.getByRole("textbox", { name: /^Nom/ }).fill(`Invitée ${suffix}`);
    await sheet.getByRole("textbox", { name: /^Courriel/ }).fill(inviteeEmail);
    await sheet.getByRole("button", { name: /Inviter|Envoyer/ }).click();
    await expect(page.getByText("Invitation en attente").first()).toBeVisible();

    await page.goto("/admin/courriels");
    await expect(page.getByText(inviteeEmail).first()).toBeVisible();
    const log = await prisma.emailLog.findFirstOrThrow({
      where: { toEmail: inviteeEmail },
      orderBy: { createdAt: "desc" },
    });
    const activation = log.previewText?.match(/\/admin\/invitation\?token=[A-Za-z0-9._-]+/)?.[0];
    expect(activation).toBeTruthy();

    const context = await browser.newContext();
    const invitee = await context.newPage();
    await invitee.goto(activation!);
    await expect(invitee.getByText(/Bienvenue/)).toBeVisible();
    await invitee.getByLabel("Mot de passe", { exact: true }).fill(inviteePassword);
    await invitee.getByLabel("Confirmer le mot de passe").fill(inviteePassword);
    await invitee.getByRole("button", { name: "Activer mon compte" }).click();
    await expect(invitee).toHaveURL(/raison=invitation-acceptee/);
    await login(invitee, inviteeEmail, inviteePassword);
    await context.close();

    // The link is single-use.
    await page.goto(activation!);
    await expect(page.getByText("Invitation invalide")).toBeVisible();
  });

  test("directory: search, profile and JSON export", async ({ page }) => {
    await login(page);
    await page.goto("/admin/participants");
    await page.getByLabel("Rechercher un participant").fill(person.lastName);
    await page.getByRole("button", { name: "Filtrer" }).click();
    await page.getByRole("link", { name: `${person.firstName} ${person.lastName}` }).click();
    await expect(
      page.getByRole("heading", { name: `${person.firstName} ${person.lastName}` }),
    ).toBeVisible();
    await expect(page.getByText("Boulangerie Zoé").first()).toBeVisible();
    // "à jour" or "en attente" depending on whether the consent test changed the notice before.
    await expect(page.getByText(/^Consentement (à jour|en attente)$/)).toBeVisible();
    const exported = await page.request.get(`/admin/participants/${participantId}/export.json`);
    expect(exported.ok()).toBeTruthy();
    const bundle = await exported.json();
    expect(bundle.profile.email).toBe(person.email);
  });

  test("Law 25: « Mes données » export and deletion request → admin anonymization", async ({
    page,
  }) => {
    const participant = await prisma.participant.findUniqueOrThrow({
      where: { id: participantId },
    });
    const token = await participantToken(participant);
    await page.goto(`/p/${token}/donnees`);
    await expect(page.getByRole("heading", { name: "Mes données", exact: true })).toBeVisible();
    const json = await page.request.get(`/p/${token}/donnees/export.json`);
    expect(json.ok()).toBeTruthy();
    expect((await json.json()).profile.email).toBe(person.email);
    const csv = await page.request.get(`/p/${token}/donnees/export.csv`);
    expect(await csv.text()).toContain(person.email);

    await page.getByRole("button", { name: "Demander la suppression de mes données" }).click();
    await page.getByRole("button", { name: "Confirmer la demande" }).click();
    await expect(page.getByText(/Demande reçue/)).toBeVisible();
    expect(
      await prisma.deletionRequest.count({ where: { participantId, status: "PENDING" } }),
    ).toBe(1);

    await login(page);
    await page.goto("/admin/participants/suppressions");
    const item = page.getByRole("listitem").filter({ hasText: person.lastName });
    await expect(item.getByText("À traiter")).toBeVisible();
    await item.getByRole("button", { name: "Anonymiser", exact: true }).click();
    await page.getByRole("button", { name: "Anonymiser définitivement" }).click();
    await expect
      .poll(async () => {
        const row = await prisma.participant.findUniqueOrThrow({ where: { id: participantId } });
        return row.deletedAt !== null && row.tokenVersion === participant.tokenVersion + 1;
      })
      .toBe(true);
    // The row no longer carries the name: it is found through its link to the profile.
    await expect(
      page
        .getByRole("listitem")
        .filter({ has: page.locator(`a[href="/admin/participants/${participantId}"]`) })
        .getByText("Anonymisé"),
    ).toBeVisible();

    // The old personal link no longer opens anything.
    await page.goto(`/p/${token}`);
    await expect(page).toHaveURL(/lien-expire/);
  });
});
