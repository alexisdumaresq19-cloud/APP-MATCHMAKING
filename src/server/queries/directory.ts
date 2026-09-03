import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { CompaniesQuery } from "@/lib/validation/directory";

export const COMPANIES_PAGE_SIZE = 24;

/** What the public directory shows about a company: never a name, an email or a phone number. */
export type CompanyCard = {
  id: string;
  companyName: string;
  sector: string | null;
  city: string | null;
  region: string | null;
  website: string | null;
  offers: string[];
  needs: string[];
  soughtSectors: string[];
  description: string | null;
  eventsAttended: number;
  listedAt: Date | null;
};

const cardInclude = {
  sector: { select: { name: true } },
  _count: {
    select: {
      registrations: {
        where: {
          status: { in: ["CHECKED_IN", "CONFIRMED", "REGISTERED"] },
          event: { status: "COMPLETED" },
        },
      },
    },
  },
} satisfies Prisma.ParticipantInclude;

type CardSource = Prisma.ParticipantGetPayload<{ include: typeof cardInclude }>;

async function toCards(rows: CardSource[]): Promise<CompanyCard[]> {
  const soughtIds = [...new Set(rows.flatMap((r) => r.soughtSectorIds))];
  const sectors = soughtIds.length
    ? await prisma.sector.findMany({
        where: { id: { in: soughtIds } },
        select: { id: true, name: true },
      })
    : [];
  const nameOf = new Map(sectors.map((s) => [s.id, s.name]));
  return rows.map((row) => ({
    id: row.id,
    companyName: row.companyName,
    sector: row.sector?.name ?? null,
    city: row.city,
    region: row.region,
    website: row.website,
    offers: row.offers,
    needs: row.needs,
    soughtSectors: row.soughtSectorIds
      .map((id) => nameOf.get(id))
      .filter((name): name is string => Boolean(name)),
    description: row.description,
    eventsAttended: row._count.registrations,
    listedAt: row.directoryOptInAt,
  }));
}

/** Companies that chose to be listed, searchable by keyword, sector and region (D-36). */
export async function listPublicCompanies(
  organizationId: string,
  query: CompaniesQuery,
): Promise<{ rows: CompanyCard[]; total: number; pageCount: number }> {
  const where: Prisma.ParticipantWhereInput = {
    organizationId,
    deletedAt: null,
    directoryOptIn: true,
  };
  if (query.q) {
    const term = query.q.toLowerCase();
    where.OR = [
      { companyName: { contains: query.q, mode: "insensitive" } },
      { description: { contains: query.q, mode: "insensitive" } },
      { city: { contains: query.q, mode: "insensitive" } },
      { offers: { has: term } },
      { needs: { has: term } },
    ];
  }
  if (query.secteur) where.sectorId = query.secteur;
  if (query.region) where.region = query.region;
  const [rows, total] = await Promise.all([
    prisma.participant.findMany({
      where,
      include: cardInclude,
      orderBy: [{ companyName: "asc" }],
      skip: (query.page - 1) * COMPANIES_PAGE_SIZE,
      take: COMPANIES_PAGE_SIZE,
    }),
    prisma.participant.count({ where }),
  ]);
  return {
    rows: await toCards(rows),
    total,
    pageCount: Math.max(1, Math.ceil(total / COMPANIES_PAGE_SIZE)),
  };
}

export async function getPublicCompany(
  organizationId: string,
  participantId: string,
): Promise<CompanyCard | null> {
  if (!participantId || participantId.length > 64) return null;
  const row = await prisma.participant.findFirst({
    where: { id: participantId, organizationId, deletedAt: null, directoryOptIn: true },
    include: cardInclude,
  });
  if (!row) return null;
  const [card] = await toCards([row]);
  return card ?? null;
}

export async function countPublicCompanies(organizationId: string): Promise<number> {
  return prisma.participant.count({
    where: { organizationId, deletedAt: null, directoryOptIn: true },
  });
}
