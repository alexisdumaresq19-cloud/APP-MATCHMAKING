import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { companiesQuerySchema } from "@/lib/validation/directory";
import {
  countPublicCompanies,
  getPublicCompany,
  listPublicCompanies,
} from "@/server/queries/directory";

/** D-36: the public directory shows only companies that opted in, and nothing personal. */
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
let organizationId: string;
let listedId: string;
let hiddenId: string;

beforeAll(async () => {
  const organization = await prisma.organization.create({
    data: {
      slug: `annuaire-${suffix}`,
      name: "Org annuaire",
      consentText: "Texte de consentement de test, assez long pour la validation du formulaire.",
      consentVersion: `v-${suffix}`,
      privacyEmail: `privacy-${suffix}@test.local`,
      replyToEmail: `reply-${suffix}@test.local`,
      sectors: {
        create: [
          { name: "Garderie", slug: "garderie", sortOrder: 0 },
          { name: "Traiteur", slug: "traiteur", sortOrder: 1 },
        ],
      },
    },
    include: { sectors: true },
  });
  organizationId = organization.id;
  const [garderie, traiteur] = organization.sectors;
  const listed = await prisma.participant.create({
    data: {
      organizationId,
      email: `listed-${suffix}@test.local`,
      firstName: "Marie",
      lastName: "Secret",
      phone: "+14185550100",
      companyName: "Traiteur Marie",
      sectorId: traiteur.id,
      city: "Gaspé",
      region: "Gaspésie–Îles-de-la-Madeleine",
      website: "https://traiteurmarie.ca",
      offers: ["boîtes à lunch", "traiteur"],
      needs: ["événements corporatifs"],
      soughtSectorIds: [garderie.id],
      description: "Repas pour événements.",
      directoryOptIn: true,
      directoryOptInAt: new Date(),
    },
  });
  listedId = listed.id;
  const hidden = await prisma.participant.create({
    data: {
      organizationId,
      email: `hidden-${suffix}@test.local`,
      firstName: "Paul",
      lastName: "Discret",
      companyName: "Garderie Paul",
      sectorId: garderie.id,
      region: "Montréal",
      offers: ["garde d'enfants"],
      needs: [],
    },
  });
  hiddenId = hidden.id;
  await prisma.participant.create({
    data: {
      organizationId,
      email: `gone-${suffix}@anonyme.invalid`,
      firstName: "Participant",
      lastName: "supprimé",
      companyName: "Entreprise retirée",
      offers: [],
      needs: [],
      directoryOptIn: true,
      deletedAt: new Date(),
    },
  });
});

afterAll(async () => {
  await prisma.organization.deleteMany({ where: { id: organizationId } });
  await prisma.$disconnect();
});

describe("public companies directory", () => {
  it("lists only companies that opted in and are not anonymized", async () => {
    const result = await listPublicCompanies(organizationId, companiesQuerySchema.parse({}));
    expect(result.total).toBe(1);
    expect(result.rows.map((r) => r.companyName)).toEqual(["Traiteur Marie"]);
    expect(await countPublicCompanies(organizationId)).toBe(1);
  });

  it("exposes company facts only, never the person behind it", async () => {
    const card = await getPublicCompany(organizationId, listedId);
    expect(card).not.toBeNull();
    expect(card?.sector).toBe("Traiteur");
    expect(card?.soughtSectors).toEqual(["Garderie"]);
    expect(card?.website).toBe("https://traiteurmarie.ca");
    const serialized = JSON.stringify(card);
    expect(serialized).not.toContain("Marie Secret");
    expect(serialized).not.toContain("@test.local");
    expect(serialized).not.toContain("+1418");
  });

  it("hides a company that did not opt in, even by direct link", async () => {
    expect(await getPublicCompany(organizationId, hiddenId)).toBeNull();
  });

  it("searches by keyword (tags, name, city), sector and region", async () => {
    const byTag = await listPublicCompanies(
      organizationId,
      companiesQuerySchema.parse({ q: "Traiteur" }),
    );
    expect(byTag.total).toBe(1);
    const byCity = await listPublicCompanies(
      organizationId,
      companiesQuerySchema.parse({ q: "gaspé" }),
    );
    expect(byCity.total).toBe(1);
    const byRegion = await listPublicCompanies(
      organizationId,
      companiesQuerySchema.parse({ region: "Montréal" }),
    );
    expect(byRegion.total).toBe(0);
    const none = await listPublicCompanies(
      organizationId,
      companiesQuerySchema.parse({ q: "plomberie" }),
    );
    expect(none.total).toBe(0);
    expect(none.pageCount).toBe(1);
  });
});
