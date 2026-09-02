import { NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { getOrganizerContext } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { buildPersonalDataBundle } from "@/server/services/privacy";

/** A participant's full data, for an access request handled by the organizer (S4-05). */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getOrganizerContext();
  if (!session) return new NextResponse("Non autorisé", { status: 401 });
  const { id } = await context.params;
  const participant = await prisma.participant.findFirst({
    where: { id, organizationId: session.organization.id },
    select: { id: true, lastName: true },
  });
  if (!participant) return new NextResponse("Introuvable", { status: 404 });
  const bundle = await buildPersonalDataBundle(participant.id);
  await audit({
    organizationId: session.organization.id,
    actorType: "organizer",
    actorId: session.organizer.id,
    action: "EXPORT",
    entity: "Participant",
    entityId: participant.id,
    metadata: { format: "json" },
  });
  return new NextResponse(JSON.stringify(bundle, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="donnees-${participant.id.slice(-6)}.json"`,
      "Cache-Control": "private, no-store",
    },
  });
}
