import { NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { resolveParticipantAccess } from "@/lib/auth/participant-session";
import { toCsv } from "@/lib/export/csv";
import { buildPersonalDataBundle, bundleToCsvRows } from "@/server/services/privacy";

/** « Mes données » as a CSV that opens directly in Excel (Law 25 access right, S4-05). */
export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const access = await resolveParticipantAccess(token);
  if (!access) return new NextResponse("Lien invalide", { status: 401 });
  const bundle = await buildPersonalDataBundle(access.participant.id);
  await audit({
    organizationId: access.organization.id,
    actorType: "participant",
    actorId: access.participant.id,
    action: "EXPORT",
    entity: "Participant",
    entityId: access.participant.id,
    metadata: { format: "csv" },
  });
  const csv = toCsv(["Section", "Champ", "Valeur"], bundleToCsvRows(bundle));
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="mes-donnees.csv"',
      "Cache-Control": "private, no-store",
    },
  });
}
