import type { Prisma } from "@prisma/client";
import { formatDate } from "@/lib/dates";
import { prisma } from "@/lib/db/prisma";
import { registrationSourceLabel, registrationStatusLabel } from "@/lib/labels";
import { formatPhone } from "@/lib/normalize";
import type { RegistrantsQuery } from "@/lib/validation/event";
import { currentConsentVersion } from "@/server/services/consent";

export const EXPORT_HEADER = [
  "Prénom",
  "Nom",
  "Courriel",
  "Téléphone",
  "Titre",
  "Entreprise",
  "Secteur",
  "Région",
  "Ville",
  "Site web",
  "Description",
  "Offres",
  "Besoins",
  "Secteurs recherchés",
  "Objectif",
  "Statut",
  "Source",
  "Consentement",
  "Inscrit le",
  "Notes internes",
  "Nb jumelages",
  "Jumelages",
];

/** Rows of the registrants list with the same filters as the screen (no pagination, 5 000 max). */
export async function exportRegistrantsRows(
  organization: { id: string; timezone: string; consentText: string; consentVersion: string },
  eventId: string,
  query: RegistrantsQuery,
): Promise<(string | number | null)[][]> {
  const where: Prisma.EventRegistrationWhereInput = { eventId };
  const participant: Prisma.ParticipantWhereInput = {};
  if (query.q) {
    participant.OR = [
      { firstName: { contains: query.q, mode: "insensitive" } },
      { lastName: { contains: query.q, mode: "insensitive" } },
      { companyName: { contains: query.q, mode: "insensitive" } },
      { email: { contains: query.q, mode: "insensitive" } },
    ];
  }
  if (query.secteur) participant.sectorId = query.secteur;
  if (query.region) participant.region = query.region;
  if (Object.keys(participant).length) where.participant = participant;
  if (query.statut) where.status = query.statut;
  if (query.source) where.source = query.source;

  const rows = await prisma.eventRegistration.findMany({
    where,
    take: 5000,
    orderBy: [{ participant: { lastName: "asc" } }, { participant: { firstName: "asc" } }],
    include: {
      participant: { include: { sector: true } },
      matchesAsA: {
        where: { status: { not: "EXCLUDED" } },
        include: { b: { include: { participant: true } } },
      },
      matchesAsB: {
        where: { status: { not: "EXCLUDED" } },
        include: { a: { include: { participant: true } } },
      },
    },
  });
  const sectorNames = new Map(
    (
      await prisma.sector.findMany({
        where: { organizationId: organization.id },
        select: { id: true, name: true },
      })
    ).map((s) => [s.id, s.name]),
  );
  const consentVersion = currentConsentVersion(organization);
  const consented = new Set(
    (
      await prisma.consentLog.findMany({
        where: { consentVersion, participantId: { in: rows.map((r) => r.participantId) } },
        select: { participantId: true },
      })
    ).map((c) => c.participantId),
  );

  return rows.map((row) => {
    const p = row.participant;
    const partners = [
      ...row.matchesAsA.map(
        (m) =>
          `${m.b.participant.firstName} ${m.b.participant.lastName} (${m.b.participant.companyName})`,
      ),
      ...row.matchesAsB.map(
        (m) =>
          `${m.a.participant.firstName} ${m.a.participant.lastName} (${m.a.participant.companyName})`,
      ),
    ];
    return [
      p.firstName,
      p.lastName,
      p.email,
      formatPhone(p.phone),
      p.jobTitle,
      p.companyName,
      p.sector?.name ?? null,
      p.region,
      p.city,
      p.website,
      p.description,
      p.offers.join(" | "),
      p.needs.join(" | "),
      p.soughtSectorIds
        .map((id) => sectorNames.get(id))
        .filter(Boolean)
        .join(" | "),
      row.goalsText,
      registrationStatusLabel(row.status),
      registrationSourceLabel(row.source),
      consented.has(p.id) ? "Oui" : "En attente",
      formatDate(row.createdAt, organization.timezone, "short"),
      row.notes,
      partners.length,
      partners.join(" ; "),
    ];
  });
}
