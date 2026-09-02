import { NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { getOrganizerContext } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { toCsv } from "@/lib/export/csv";
import { registrantsQuerySchema } from "@/lib/validation/event";
import { EXPORT_HEADER, exportRegistrantsRows } from "@/server/services/registrants-export";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getOrganizerContext();
  if (!session) return new NextResponse("Non autorisé", { status: 401 });
  const { id } = await context.params;
  const event = await prisma.event.findFirst({
    where: { id, organizationId: session.organization.id },
  });
  if (!event) return new NextResponse("Introuvable", { status: 404 });
  const query = registrantsQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
  const rows = await exportRegistrantsRows(session.organization, event.id, query);
  await audit({
    organizationId: session.organization.id,
    actorType: "organizer",
    actorId: session.organizer.id,
    action: "EXPORT",
    entity: "EventRegistration",
    entityId: event.id,
    metadata: { format: "csv", rows: rows.length },
  });
  return new NextResponse(toCsv(EXPORT_HEADER, rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="inscrits-${event.slug}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
