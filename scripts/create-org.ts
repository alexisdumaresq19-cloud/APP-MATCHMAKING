/* Creates a new organization with its OWNER account (Phase 1 super-admin CLI).
 * Usage:
 *   pnpm create-org --slug allyson --name "Allyson Handfield" --owner-email a@b.c --owner-name "Allyson" \
 *     [--platform-name Jumelage] [--privacy-email x@y.z] [--reply-to x@y.z] [--privacy-officer "Nom"]
 */
import { parseArgs } from "node:util";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/auth/password";
import { hashConsentText, randomToken } from "../src/lib/crypto";
import { defaultConsentText } from "../src/lib/defaults/consent-text";
import { DEFAULT_SECTORS } from "../src/lib/defaults/sectors";
import { slugify } from "../src/lib/normalize";

const prisma = new PrismaClient();

async function main() {
  const { values } = parseArgs({
    options: {
      slug: { type: "string" },
      name: { type: "string" },
      "owner-email": { type: "string" },
      "owner-name": { type: "string" },
      "platform-name": { type: "string", default: "Jumelage" },
      "privacy-email": { type: "string" },
      "reply-to": { type: "string" },
      "privacy-officer": { type: "string" },
    },
  });
  const name = values.name;
  const ownerEmail = values["owner-email"]?.trim().toLowerCase();
  const ownerName = values["owner-name"];
  if (!name || !ownerEmail || !ownerName) {
    console.error("Arguments requis : --name, --owner-email, --owner-name (et --slug recommandé).");
    process.exit(1);
  }
  const slug = slugify(values.slug ?? name);
  const privacyEmail = values["privacy-email"] ?? ownerEmail;
  const replyToEmail = values["reply-to"] ?? ownerEmail;
  const consentText = defaultConsentText({
    organizationName: name,
    privacyOfficer: values["privacy-officer"] ?? ownerName,
    privacyEmail,
  });

  const existing = await prisma.organization.findUnique({ where: { slug } });
  if (existing) {
    console.error(`Une organisation avec le slug "${slug}" existe déjà.`);
    process.exit(1);
  }

  const temporaryPassword = `Temp-${randomToken(9)}`;
  const organization = await prisma.organization.create({
    data: {
      slug,
      name,
      platformName: values["platform-name"] ?? "Jumelage",
      consentText,
      consentVersion: hashConsentText(consentText),
      privacyEmail,
      replyToEmail,
      organizers: {
        create: {
          email: ownerEmail,
          name: ownerName,
          role: "OWNER",
          passwordHash: await hashPassword(temporaryPassword),
        },
      },
      sectors: {
        create: DEFAULT_SECTORS.map((sector, index) => ({
          name: sector.name,
          slug: sector.slug,
          sortOrder: index,
        })),
      },
      matchingRuleSets: { create: { name: "Règles par défaut", isDefault: true } },
    },
    include: { sectors: true },
  });

  // Symmetric affinity matrix initialised at 50 (same sector: 10).
  const rows = [];
  const sectors = [...organization.sectors].sort((a, b) => (a.id < b.id ? -1 : 1));
  for (let i = 0; i < sectors.length; i += 1) {
    for (let j = i; j < sectors.length; j += 1) {
      rows.push({
        organizationId: organization.id,
        fromSectorId: sectors[i].id,
        toSectorId: sectors[j].id,
        score: i === j ? 10 : 50,
      });
    }
  }
  await prisma.sectorAffinity.createMany({ data: rows });

  console.log(`Organisation créée : ${organization.name} (slug : ${organization.slug})`);
  console.log(`Compte OWNER : ${ownerEmail}`);
  console.log(`Mot de passe temporaire (à changer à la première connexion) : ${temporaryPassword}`);
  console.log(`Page de connexion : /admin/login`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
