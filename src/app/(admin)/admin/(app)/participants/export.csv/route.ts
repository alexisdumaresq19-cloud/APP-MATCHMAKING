import { NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { requireOrganizer } from "@/lib/auth/session";
import { formatDate } from "@/lib/dates";
import { toCsv } from "@/lib/export/csv";
import { participantsQuerySchema } from "@/lib/validation/organization";
import { listDirectory } from "@/server/queries/participants";
import { currentConsentVersion } from "@/server/services/consent";

/** CSV of the participants directory with the current filters (Phase 2, P2-S1). */
export async function GET(request: Request) {
  const { organizer, organization } = await requireOrganizer();
  const url = new URL(request.url);
  const parsed = participantsQuerySchema.safeParse(Object.fromEntries(url.searchParams));
  const query = parsed.success ? parsed.data : participantsQuerySchema.parse({});
  const { rows } = await listDirectory(
    organization.id,
    currentConsentVersion(organization),
    query,
    {
      all: true,
    },
  );
  const csv = toCsv(
    [
      "Nom",
      "Courriel",
      "Entreprise",
      "Secteur",
      "Région",
      "Événements",
      "Dernier événement",
      "Consentement",
      "Annuaire public",
      "Invitations",
      "Statut",
    ],
    rows.map((row) => [
      row.name,
      row.email,
      row.company,
      row.sector ?? "",
      row.region ?? "",
      row.registrations,
      row.lastEvent
        ? `${row.lastEvent.name} (${formatDate(row.lastEvent.startsAt, organization.timezone, "date")})`
        : "",
      row.consented ? "À jour" : "En attente",
      row.directoryOptIn ? "Oui" : "Non",
      row.invitationsOptOut ? "Refusées" : "Acceptées",
      row.deletedAt ? "Anonymisé" : row.pendingDeletion ? "Suppression demandée" : "Actif",
    ]),
  );
  await audit({
    organizationId: organization.id,
    actorType: "organizer",
    actorId: organizer.id,
    action: "EXPORT",
    entity: "Participant",
    entityId: organization.id,
    metadata: { rows: rows.length, filters: query },
  });
  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="participants-${stamp}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
