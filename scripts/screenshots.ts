/* Captures screenshots of the running app (public, participant, admin) for documentation.
 * Usage: set -a; . ./.env; set +a; pnpm exec tsx scripts/screenshots.ts --out ./docs/screenshots
 * Requires a seeded database (pnpm db:seed) and a server on E2E_BASE_URL (default http://localhost:3000).
 * Optional: PW_CHROMIUM_PATH to reuse a system Chromium.
 */
import { mkdirSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { chromium, devices, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { SignJWT } from "jose";

const { values } = parseArgs({ options: { out: { type: "string", default: "./screenshots" } } });
const outDir = path.resolve(values.out ?? "./screenshots");
mkdirSync(outDir, { recursive: true });
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const prisma = new PrismaClient();

async function participantToken(p: { id: string; organizationId: string; tokenVersion: number }) {
  const secret = process.env.PARTICIPANT_TOKEN_SECRET;
  if (!secret) throw new Error("PARTICIPANT_TOKEN_SECRET is required");
  return new SignJWT({ org: p.organizationId, v: p.tokenVersion, purpose: "access" })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(p.id)
    .setIssuer("matchmaking-events")
    .setAudience("participant")
    .setIssuedAt()
    .setExpirationTime("2h")
    .sign(new TextEncoder().encode(secret));
}

async function shot(page: Page, name: string, options: { fullPage?: boolean } = {}) {
  await page.waitForLoadState("networkidle");
  await page.screenshot({
    path: path.join(outDir, `${name}.png`),
    fullPage: options.fullPage ?? false,
  });
  console.log("captured", name);
}

async function main() {
  const browser = await chromium.launch({
    executablePath: process.env.PW_CHROMIUM_PATH || undefined,
  });
  const eventSlug = "rencontres-affaires-printemps";
  const event = await prisma.event.findFirstOrThrow({
    where: { slug: eventSlug, organization: { slug: "demo" } },
  });
  const registration = await prisma.eventRegistration.findFirstOrThrow({
    where: { eventId: event.id, status: "REGISTERED", participant: { sectorId: { not: null } } },
    include: { participant: true },
  });
  const token = await participantToken(registration.participant);

  // ---- Mobile: public registration + participant space ----
  const mobile = await browser.newContext({
    ...devices["Pixel 7"],
    locale: "fr-CA",
    timezoneId: "America/Toronto",
  });
  const m = await mobile.newPage();
  await m.goto(`${baseURL}/e/demo/${eventSlug}`);
  await shot(m, "01-public-evenement");
  await m.locator("#inscription").scrollIntoViewIfNeeded();
  await m.evaluate(() =>
    document.querySelector("#inscription")?.scrollIntoView({ block: "start" }),
  );
  await shot(m, "02-inscription-etape-1");
  await m.getByLabel("Prénom").fill("Marie");
  await m.getByRole("textbox", { name: "Nom", exact: true }).fill("Tremblay");
  await m.getByLabel("Courriel").fill(`marie.tremblay+${Date.now()}@exemple.quebec`);
  await m.getByLabel("Téléphone").fill("514 555-0142");
  await m.getByRole("button", { name: "Continuer" }).click();
  await m.getByLabel("Nom de l'entreprise").fill("Garderie Les Petits Pas");
  await m.getByLabel("Secteur d'activité").selectOption({ label: "Garderie / petite enfance" });
  await m.getByLabel("Région").selectOption("Montréal");
  await m.getByLabel("Ville").fill("Montréal");
  await m.getByLabel("Site web").fill("petitspas.ca");
  await m
    .getByLabel("Description courte de votre entreprise")
    .fill("Garderie de 40 places à Rosemont, ouverte depuis 2015.");
  await m.evaluate(() =>
    document.querySelector("#inscription")?.scrollIntoView({ block: "start" }),
  );
  await shot(m, "03-inscription-etape-2");
  await m.getByRole("button", { name: "Continuer" }).click();
  const offers = m.getByLabel("Ce que vous offrez");
  for (const t of ["garde d'enfants", "camp de jour"]) {
    await offers.fill(t);
    await offers.press("Enter");
  }
  const needs = m.getByLabel("Ce que vous cherchez");
  for (const t of ["entretien ménager", "traiteur", "comptabilité"]) {
    await needs.fill(t);
    await needs.press("Enter");
  }
  await m.evaluate(() =>
    document.querySelector("#inscription")?.scrollIntoView({ block: "start" }),
  );
  await shot(m, "04-inscription-etape-3");
  await m.getByLabel(/J'ai lu cet avis/).scrollIntoViewIfNeeded();
  await m.getByLabel(/J'ai lu cet avis/).check();
  await shot(m, "05-inscription-consentement");
  await m.waitForTimeout(3200);
  await m.getByRole("button", { name: "Confirmer mon inscription" }).click();
  await m.waitForURL(/\/merci$/);
  await shot(m, "06-inscription-merci");

  await m.goto(`${baseURL}/p/${token}`);
  await shot(m, "07-participant-accueil");
  await m.goto(`${baseURL}/p/${token}/evenements/${event.id}`);
  await shot(m, "08-participant-evenement");
  await m.goto(`${baseURL}/p/${token}/profil`);
  await shot(m, "09-participant-profil");
  await m.goto(`${baseURL}/p/lien-expire`);
  await shot(m, "10-participant-lien-expire");
  await m.goto(`${baseURL}/demo/confidentialite`);
  await shot(m, "11-confidentialite");
  await mobile.close();

  // ---- Desktop: organizer ----
  const desktop = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: "fr-CA",
    timezoneId: "America/Toronto",
  });
  const d = await desktop.newPage();
  await d.goto(`${baseURL}/admin/login`);
  await shot(d, "12-admin-connexion");
  await d.getByLabel("Courriel").first().fill("owner@demo.local");
  await d.getByLabel("Mot de passe").fill("Demo-1234!");
  await d.getByRole("button", { name: "Se connecter" }).click();
  await d.waitForURL(/\/admin$/);
  await shot(d, "13-admin-tableau-de-bord");
  await d.goto(`${baseURL}/admin/events`);
  await shot(d, "14-admin-evenements");
  await d.goto(`${baseURL}/admin/events/${event.id}/details`);
  await shot(d, "15-admin-evenement-details");
  await d.goto(`${baseURL}/admin/events/${event.id}/inscrits`);
  await shot(d, "16-admin-inscrits");
  await d.getByRole("button", { name: "Ouvrir" }).first().click();
  await d.getByRole("dialog").waitFor();
  await d.waitForTimeout(400);
  await shot(d, "17-admin-inscrit-fiche");
  await desktop.close();

  // ---- Tablet: admin registrants (day-of usage) ----
  const tablet = await browser.newContext({
    ...devices["iPad Mini"],
    locale: "fr-CA",
    timezoneId: "America/Toronto",
  });
  const t = await tablet.newPage();
  await t.goto(`${baseURL}/admin/login`);
  await t.getByLabel("Courriel").first().fill("staff@demo.local");
  await t.getByLabel("Mot de passe").fill("Demo-1234!");
  await t.getByRole("button", { name: "Se connecter" }).click();
  await t.waitForURL(/\/admin$/);
  await t.goto(`${baseURL}/admin/events/${event.id}/inscrits`);
  await shot(t, "18-admin-inscrits-tablette");
  await tablet.close();

  await browser.close();
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
