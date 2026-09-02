import { NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { getOrganizerContext } from "@/lib/auth/session";
import { formatDate } from "@/lib/dates";
import { buildWorkbook, type Sheet } from "@/lib/export/xlsx";
import { getSeatingPlan } from "@/server/queries/tables";

/** Table plan as a workbook: one sheet per round, one row per seated person (S3-03). */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getOrganizerContext();
  if (!session) return new NextResponse("Non autorisé", { status: 401 });
  const { id } = await context.params;
  const plan = await getSeatingPlan(id, session.organization.id);
  if (!plan) return new NextResponse("Introuvable", { status: 404 });

  const sheets: Sheet[] = plan.rounds.map((round) => ({
    name:
      plan.event.roundCount > 1
        ? `Ronde ${round.round} (${formatDate(round.startsAt, session.organization.timezone, "time").replace(/\s/g, "")})`
        : "Tables",
    header: ["Table", "Nom", "Prénom", "Entreprise", "Secteur", "Verrouillé"],
    widths: [18, 22, 18, 32, 32, 12],
    rows: [
      ...round.tables.flatMap((table) =>
        table.members.map((member) => {
          const [firstName, ...rest] = member.name.split(" ");
          return [
            table.name,
            rest.join(" "),
            firstName,
            member.company,
            member.sector,
            member.isLocked ? "Oui" : "",
          ];
        }),
      ),
      ...round.unplaced.map((member) => {
        const [firstName, ...rest] = member.name.split(" ");
        return ["Non placé", rest.join(" "), firstName, member.company, member.sector, ""];
      }),
    ],
  }));
  const buffer = await buildWorkbook(sheets);
  await audit({
    organizationId: session.organization.id,
    actorType: "organizer",
    actorId: session.organizer.id,
    action: "EXPORT",
    entity: "Event",
    entityId: id,
    metadata: { export: "tables.xlsx", rounds: plan.rounds.length },
  });
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="plan-de-tables-${plan.event.id.slice(-6)}.xlsx"`,
      "Cache-Control": "private, no-store",
    },
  });
}
