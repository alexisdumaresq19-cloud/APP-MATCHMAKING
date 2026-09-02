import { expect, test, type Page } from "@playwright/test";
import { OWNER, clearRateLimits, participantToken, prisma, uniqueEmail } from "./helpers";

/**
 * D-35 — a company discovers the events (showcase page), registers in one click from its space,
 * gets invited by email to a new event, and can opt out of invitations.
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

test.describe("Companies: showcase, one-click registration, invitations", () => {
  let organizationId: string;
  let eventId: string;
  const eventName = `Soirée invitations ${suffix}`;
  const eventSlug = `invitations-${suffix}`;
  const nadia = {
    id: "",
    firstName: "Nadia",
    lastName: `Vitrine-${suffix}`,
    email: uniqueEmail("nadia"),
  };
  const omar = {
    id: "",
    firstName: "Omar",
    lastName: `Invité-${suffix}`,
    email: uniqueEmail("omar"),
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
        slug: eventSlug,
        name: eventName,
        startsAt: new Date(Date.now() + 5 * 86_400_000),
        endsAt: new Date(Date.now() + 5 * 86_400_000 + 2 * 3_600_000),
        venueName: "Bistro des tests",
        capacity: 40,
        status: "OPEN",
        tableCount: 4,
        seatsPerTable: 4,
      },
    });
    eventId = event.id;
    for (const person of [nadia, omar]) {
      const participant = await prisma.participant.create({
        data: {
          organizationId,
          email: person.email,
          firstName: person.firstName,
          lastName: person.lastName,
          companyName: `${person.firstName} traiteur`,
          sectorId: sector.id,
          offers: ["boîtes à lunch"],
          needs: ["événements corporatifs"],
          consents: {
            create: {
              consentVersion: organization.consentVersion,
              consentText: organization.consentText,
            },
          },
        },
      });
      person.id = participant.id;
    }
  });

  test.afterAll(async () => {
    await prisma.event.deleteMany({ where: { id: eventId } });
    await prisma.participant.deleteMany({ where: { id: { in: [nadia.id, omar.id] } } });
    await prisma.$disconnect();
  });

  test("the showcase page lists the open event with registration and calendar links", async ({
    page,
  }) => {
    await page.goto("/demo");
    await expect(page.getByRole("heading", { name: "Nos prochains événements" })).toBeVisible();
    const card = page.getByRole("listitem").filter({ hasText: eventName });
    await expect(card.getByText("Inscriptions ouvertes")).toBeVisible();
    await expect(card.getByText("Il reste 40 places")).toBeVisible();
    await expect(card.getByRole("link", { name: "S'inscrire" })).toHaveAttribute(
      "href",
      `/e/demo/${eventSlug}`,
    );
    await expect(card.getByRole("link", { name: "Ajouter à mon calendrier" })).toBeVisible();
    await expect(card.getByRole("link", { name: "Google Agenda" })).toBeVisible();
    const ics = await page.request.get(`/e/demo/${eventSlug}/calendrier.ics`);
    expect(ics.ok()).toBeTruthy();
    expect(await ics.text()).toContain("BEGIN:VEVENT");
  });

  test("a known company registers in one click from its personal space", async ({ page }) => {
    const participant = await prisma.participant.findUniqueOrThrow({ where: { id: nadia.id } });
    const token = await participantToken(participant);
    await page.goto(`/p/${token}`);
    await expect(page.getByRole("heading", { name: "Autres événements ouverts" })).toBeVisible();
    await page.getByRole("link", { name: new RegExp(eventName) }).click();
    await expect(page.getByRole("heading", { name: "Inscrivez-vous en un clic" })).toBeVisible();
    await expect(page.getByText("Nadia traiteur")).toBeVisible();
    await page.getByLabel("Qu'espérez-vous retirer de cet événement?").fill("De nouveaux clients");
    await page.getByRole("button", { name: "Confirmer mon inscription" }).click();
    await expect(page).toHaveURL(new RegExp(`/p/${token}/evenements/${eventId}$`));

    const registration = await prisma.eventRegistration.findUniqueOrThrow({
      where: { eventId_participantId: { eventId, participantId: nadia.id } },
    });
    expect(registration.status).toBe("REGISTERED");
    expect(registration.offersSnapshot).toEqual(["boîtes à lunch"]);
    expect(registration.goalsText).toBe("De nouveaux clients");

    // The event moved from « Autres événements ouverts » to « Événements à venir ».
    await page.goto(`/p/${token}`);
    await expect(page.getByRole("heading", { name: "Événements à venir" })).toBeVisible();
    const upcoming = page.locator("section").filter({ hasText: "Événements à venir" }).first();
    await expect(upcoming.getByText(eventName)).toBeVisible();
  });

  test("the organizer invites past participants; the invited company registers from the email", async ({
    page,
    browser,
  }) => {
    await login(page);
    await page.goto(`/admin/events/${eventId}/publication`);
    await page.getByRole("button", { name: /Inviter les participants passés/ }).click();
    await expect(page.getByText(/entreprises? de votre annuaire/)).toBeVisible();
    await page.getByRole("button", { name: "Envoyer les invitations" }).click();
    await expect(page.getByText("Invitations envoyées")).toBeVisible({ timeout: 120_000 });

    // Nadia is registered: no invitation. Omar is not: one invitation with a one-click link.
    expect(
      await prisma.emailLog.count({
        where: { eventId, template: "event_invitation", toEmail: nadia.email },
      }),
    ).toBe(0);
    const log = await prisma.emailLog.findFirstOrThrow({
      where: { eventId, template: "event_invitation", toEmail: omar.email },
    });
    expect(log.status).toBe("sent");
    const link = log.previewText?.match(
      new RegExp(`/e/demo/${eventSlug}/inscription-rapide\\?token=[A-Za-z0-9._-]+`),
    )?.[0];
    expect(link).toBeTruthy();

    const context = await browser.newContext();
    const invitee = await context.newPage();
    await invitee.goto(link!);
    await expect(invitee.getByRole("heading", { name: /inscrivez-vous en un clic/ })).toBeVisible();
    await invitee.getByRole("button", { name: "Confirmer mon inscription" }).click();
    await expect(invitee).toHaveURL(new RegExp(`/e/demo/${eventSlug}/merci$`));
    await context.close();
    const registration = await prisma.eventRegistration.findUnique({
      where: { eventId_participantId: { eventId, participantId: omar.id } },
    });
    expect(registration?.status).toBe("REGISTERED");

    // A second run has nobody new to invite: everyone was invited once.
    await page.reload();
    await expect(page.getByText(/déjà invitée/)).toBeVisible();
  });

  test("« Ne plus recevoir d'invitations » is honoured immediately", async ({ page }) => {
    const participant = await prisma.participant.findUniqueOrThrow({ where: { id: omar.id } });
    const token = await participantToken(participant);
    await page.goto(`/p/${token}/invitations`);
    await page.getByRole("button", { name: "Ne plus recevoir d'invitations" }).click();
    await expect(
      page.getByRole("button", { name: "Recevoir à nouveau les invitations" }),
    ).toBeVisible();
    await expect
      .poll(async () => {
        const row = await prisma.participant.findUniqueOrThrow({ where: { id: omar.id } });
        return row.invitationsOptOut;
      })
      .toBe(true);
    await page.goto(`/p/${token}/donnees`);
    await expect(page.getByText("Vous ne recevez plus d'invitations par courriel.")).toBeVisible();
  });
});
