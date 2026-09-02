/* Demo seed — see section 11 of the specification.
 * Run: pnpm db:reset && pnpm db:seed
 */
import { fakerFR_CA as faker } from "@faker-js/faker";
import { PrismaClient, type RegistrationSource, type RegistrationStatus } from "@prisma/client";
import { hashPassword } from "../src/lib/auth/password";
import { hashConsentText } from "../src/lib/crypto";
import { defaultConsentText } from "../src/lib/defaults/consent-text";
import { SECTOR_TAGS } from "../src/lib/defaults/sector-tags";
import { DEFAULT_SECTORS, affinityFor } from "../src/lib/defaults/sectors";
import { REGIONS } from "../src/lib/regions";
import { runMatchingForEvent } from "../src/server/services/matching";
import { runSeatingForEvent } from "../src/server/services/seating";

const prisma = new PrismaClient();
faker.seed(20261015);

const DAY = 24 * 60 * 60 * 1000;
const DEMO_PASSWORD = "Demo-1234!";

const REGION_WEIGHTS: [string, number][] = [
  ["Montréal", 40],
  ["Laval", 15],
  ["Montérégie", 18],
  ["Laurentides", 6],
  ["Lanaudière", 6],
  ["Capitale-Nationale", 4],
  ["Estrie", 3],
  ["Outaouais", 2],
  ["Mauricie", 2],
  ["Gaspésie–Îles-de-la-Madeleine", 2],
  ["Centre-du-Québec", 1],
  ["Hors Québec", 1],
];

const AREA_CODES = ["514", "438", "450", "579", "418", "581", "819", "873"];

function weighted<T>(items: [T, number][]): T {
  const total = items.reduce((sum, [, w]) => sum + w, 0);
  let roll = faker.number.int({ min: 1, max: total });
  for (const [item, weight] of items) {
    roll -= weight;
    if (roll <= 0) return item;
  }
  return items[items.length - 1][0];
}

function pick<T>(items: T[], count: number): T[] {
  return faker.helpers.arrayElements(items, Math.min(count, items.length));
}

function phone(): string {
  const area = faker.helpers.arrayElement(AREA_CODES);
  return `+1${area}555${String(faker.number.int({ min: 100, max: 199 }))}`
    .padEnd(12, "0")
    .slice(0, 12);
}

function at(base: Date, hour: number, minute = 0): Date {
  // base is a UTC date at midnight; Montréal local time = UTC-4 (summer) / UTC-5 (winter).
  const month = base.getUTCMonth() + 1;
  const offset = month >= 4 && month <= 10 ? 4 : 5;
  return new Date(
    Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate(), hour + offset, minute),
  );
}

function dayOffset(days: number): Date {
  const d = new Date(Date.now() + days * DAY);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

async function main() {
  console.log("Seeding demo organization…");
  await prisma.organization.deleteMany({ where: { slug: "demo" } });

  const consentText = defaultConsentText({
    organizationName: "Démo Réseautage",
    privacyOfficer: "Allyson Démo",
    privacyEmail: "confidentialite@demo.local",
  });
  const consentVersion = hashConsentText(consentText);

  const organization = await prisma.organization.create({
    data: {
      slug: "demo",
      name: "Démo Réseautage",
      platformName: "Jumelage",
      consentText,
      consentVersion,
      privacyEmail: "confidentialite@demo.local",
      replyToEmail: "bonjour@demo.local",
      consentVersions: {
        create: { version: consentVersion, text: consentText, note: "Texte initial" },
      },
    },
  });

  const passwordHash = await hashPassword(DEMO_PASSWORD);
  await prisma.organizer.createMany({
    data: [
      {
        organizationId: organization.id,
        email: "owner@demo.local",
        name: "Allyson Démo",
        role: "OWNER",
        passwordHash,
      },
      {
        organizationId: organization.id,
        email: "staff@demo.local",
        name: "Camille Assistante",
        role: "STAFF",
        passwordHash,
      },
    ],
  });

  // Sectors + symmetric affinity matrix (one row per unordered pair, sorted by id).
  const sectors = [] as { id: string; slug: string; name: string }[];
  for (const [index, sector] of DEFAULT_SECTORS.entries()) {
    const created = await prisma.sector.create({
      data: {
        organizationId: organization.id,
        name: sector.name,
        slug: sector.slug,
        sortOrder: index,
      },
    });
    sectors.push(created);
  }
  const affinityRows = [];
  for (let i = 0; i < sectors.length; i += 1) {
    for (let j = i; j < sectors.length; j += 1) {
      const [a, b] = [sectors[i], sectors[j]].sort((x, y) => (x.id < y.id ? -1 : 1));
      affinityRows.push({
        organizationId: organization.id,
        fromSectorId: a.id,
        toSectorId: b.id,
        score: affinityFor(a.slug, b.slug),
      });
    }
  }
  await prisma.sectorAffinity.createMany({ data: affinityRows });
  // "Avec qui aimeriez-vous collaborer ?" — the sectors pre-checked at registration (affinity ≥ 65).
  const suggestedFor = (slug: string): string[] =>
    sectors
      .filter((other) => other.slug !== slug)
      .map((other) => ({ id: other.id, score: affinityFor(slug, other.slug) }))
      .filter((entry) => entry.score >= 65)
      .sort((x, y) => y.score - x.score)
      .slice(0, 5)
      .map((entry) => entry.id);

  const ruleSet = await prisma.matchingRuleSet.create({
    data: { organizationId: organization.id, name: "Règles par défaut", isDefault: true },
  });

  // Participants
  const usedEmails = new Set<string>();
  const participants = [];
  const sectorWeights: [(typeof sectors)[number], number][] = sectors.map((s) => [
    s,
    s.slug === "autre" ? 1 : 4,
  ]);
  for (let i = 0; i < 120; i += 1) {
    const sector = weighted(sectorWeights);
    const tags = SECTOR_TAGS[sector.slug] ?? SECTOR_TAGS.autre;
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    let email = faker.internet
      .email({ firstName, lastName, provider: "exemple.quebec" })
      .toLowerCase();
    while (usedEmails.has(email)) email = `${i}.${email}`;
    usedEmails.add(email);
    const region = weighted(REGION_WEIGHTS);
    const offers = pick(tags.offers, faker.number.int({ min: 1, max: 3 }));
    // Most participants keep the suggested sectors as is; some add or remove one; a quarter also
    // skip the free-text needs, as the guideline allows.
    const suggested = suggestedFor(sector.slug);
    const soughtSectorIds = faker.datatype.boolean(0.7)
      ? suggested
      : faker.datatype.boolean()
        ? suggested.slice(1)
        : [
            ...suggested,
            ...pick(
              sectors
                .filter((s) => !suggested.includes(s.id) && s.id !== sector.id)
                .map((s) => s.id),
              1,
            ),
          ];
    const needs =
      soughtSectorIds.length && faker.datatype.boolean(0.25)
        ? []
        : pick(tags.needs, faker.number.int({ min: 2, max: 4 }));
    const created = await prisma.participant.create({
      data: {
        organizationId: organization.id,
        email,
        firstName,
        lastName,
        phone: faker.datatype.boolean(0.8) ? phone() : null,
        companyName: faker.company.name(),
        jobTitle: faker.helpers.arrayElement([
          "Propriétaire",
          "Présidente",
          "Directeur général",
          "Fondatrice",
          "Associé",
          null,
        ]),
        sectorId: sector.id,
        website: faker.datatype.boolean(0.6) ? `https://${faker.internet.domainName()}` : null,
        city:
          region === "Montréal" ? "Montréal" : region === "Laval" ? "Laval" : faker.location.city(),
        region: REGIONS.includes(region as (typeof REGIONS)[number]) ? region : "Montréal",
        offers,
        needs,
        soughtSectorIds,
        description: faker.datatype.boolean(0.7) ? faker.company.catchPhrase().slice(0, 300) : null,
        consentedAt: new Date(),
      },
    });
    await prisma.consentLog.create({
      data: {
        participantId: created.id,
        consentVersion,
        consentText,
        ipAddress: "127.0.0.1",
        userAgent: "seed",
      },
    });
    participants.push(created);
  }

  // Events
  const pastDay = dayOffset(-45);
  const pastEvent = await prisma.event.create({
    data: {
      organizationId: organization.id,
      slug: "soiree-reseautage-automne",
      name: "Soirée réseautage d'automne",
      description:
        "Une soirée pour rencontrer des entrepreneurs complémentaires à votre entreprise.\n\nCocktail dînatoire, jumelages ciblés et rondes de rencontres de 20 minutes.",
      startsAt: at(pastDay, 17, 30),
      endsAt: at(pastDay, 20, 30),
      venueName: "Espace Réunion",
      venueAddress: "1000, rue Sherbrooke Ouest, Montréal (Québec) H3A 3G4",
      capacity: 80,
      status: "COMPLETED",
      tableCount: 10,
      seatsPerTable: 6,
      roundCount: 2,
      roundMinutes: 20,
      matchesPerParticipant: 5,
      matchingRuleSetId: ruleSet.id,
      matchedAt: at(dayOffset(-50), 10),
      publishedAt: at(dayOffset(-48), 9),
    },
  });
  const pastParticipants = pick(participants, 60);
  let checkedIn = 0;
  let platformCount = 0;
  let manualCount = 0;
  let registeredCount = 0;
  for (const [index, participant] of pastParticipants.entries()) {
    const status: RegistrationStatus =
      index < 48 ? "CHECKED_IN" : index < 56 ? "NO_SHOW" : "CANCELLED";
    const source: RegistrationSource = index % 9 === 0 ? "MANUAL" : "PLATFORM";
    await prisma.eventRegistration.create({
      data: {
        eventId: pastEvent.id,
        participantId: participant.id,
        status,
        source,
        offersSnapshot: participant.offers,
        needsSnapshot: participant.needs,
        soughtSectorsSnapshot: participant.soughtSectorIds,
        goalsText: faker.datatype.boolean(0.4)
          ? "Trouver des partenaires d'affaires dans ma région."
          : null,
        checkedInAt:
          status === "CHECKED_IN"
            ? at(pastDay, 17, 30 + faker.number.int({ min: 0, max: 40 }))
            : null,
        cancelledAt: status === "CANCELLED" ? at(dayOffset(-52), 12) : null,
        createdAt: at(dayOffset(-90 + faker.number.int({ min: 0, max: 35 })), 9),
      },
    });
    if (status !== "CANCELLED") {
      registeredCount += 1;
      if (status === "CHECKED_IN") checkedIn += 1;
      if (source === "PLATFORM") platformCount += 1;
      else manualCount += 1;
    }
  }
  await prisma.billingSnapshot.create({
    data: {
      organizationId: organization.id,
      eventId: pastEvent.id,
      totalRegistered: registeredCount,
      totalCheckedIn: checkedIn,
      totalPlatformSource: platformCount,
      totalManualSource: manualCount,
      computedAt: at(pastDay, 21),
    },
  });

  const openDay = dayOffset(30);
  const openEvent = await prisma.event.create({
    data: {
      organizationId: organization.id,
      slug: "rencontres-affaires-printemps",
      name: "Rencontres d'affaires – Printemps",
      description:
        "Trois rondes de rencontres de 20 minutes avec des entrepreneurs dont les services complètent les vôtres.\n\nPlaces limitées : inscrivez-vous tôt!",
      startsAt: at(openDay, 18),
      endsAt: at(openDay, 21),
      venueName: "Hôtel Le Central",
      venueAddress: "375, boulevard René-Lévesque Est, Montréal (Québec) H2X 3X2",
      capacity: 100,
      registrationClosesAt: at(dayOffset(28), 23, 59),
      status: "OPEN",
      tableCount: 15,
      seatsPerTable: 6,
      roundCount: 3,
      roundMinutes: 20,
      matchesPerParticipant: 5,
      matchingRuleSetId: ruleSet.id,
    },
  });
  const openParticipants = pick(participants, 85);
  for (const [index, participant] of openParticipants.entries()) {
    await prisma.eventRegistration.create({
      data: {
        eventId: openEvent.id,
        participantId: participant.id,
        status: index % 5 === 0 ? "CONFIRMED" : "REGISTERED",
        source: index % 11 === 0 ? "IMPORT" : index % 13 === 0 ? "MANUAL" : "PLATFORM",
        offersSnapshot: participant.offers,
        needsSnapshot: participant.needs,
        soughtSectorsSnapshot: participant.soughtSectorIds,
        goalsText: faker.datatype.boolean(0.5)
          ? faker.helpers.arrayElement([
              "Rencontrer des fournisseurs fiables.",
              "Trouver de nouveaux clients dans le secteur des services.",
              "Développer des partenariats à long terme.",
              "Faire connaître mon entreprise dans la région.",
            ])
          : null,
        createdAt: new Date(Date.now() - faker.number.int({ min: 0, max: 20 }) * DAY),
      },
    });
  }

  await prisma.event.create({
    data: {
      organizationId: organization.id,
      slug: "dejeuner-reseautage-laval",
      name: "Déjeuner-réseautage Laval",
      startsAt: at(dayOffset(75), 7, 30),
      endsAt: at(dayOffset(75), 9, 30),
      venueName: "Centre de congrès de Laval",
      capacity: 60,
      status: "DRAFT",
      tableCount: 8,
      seatsPerTable: 8,
      roundCount: 1,
      matchingRuleSetId: ruleSet.id,
    },
  });

  // Matching and seating on the OPEN event so the demo is alive from the first launch.
  const run = await runMatchingForEvent(openEvent.id, organization.id, { actorType: "system" });
  console.log(
    `Matching: ${run.summary.totalMatches} jumelages pour ${run.summary.eligible} inscrits (score moyen ${run.summary.averageScore}).`,
  );
  const seating = await runSeatingForEvent(openEvent.id, organization.id, { actorType: "system" });
  console.log(
    `Tables: ${seating.placed} places attribuées sur ${seating.rounds} ronde(s), ${seating.unplaced} sans place.`,
  );
  // The past event also gets matches and a table plan: « déjà rencontrés » then means something.
  await runMatchingForEvent(pastEvent.id, organization.id, { actorType: "system" });
  await runSeatingForEvent(pastEvent.id, organization.id, { actorType: "system" });

  console.log(`Done. Organization "demo" — organizer owner@demo.local / ${DEMO_PASSWORD}`);
  console.log(`Public page: /e/demo/${openEvent.slug}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
