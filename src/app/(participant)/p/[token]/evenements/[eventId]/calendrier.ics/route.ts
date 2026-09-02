import { NextResponse } from "next/server";
import { appBaseUrl, resolveParticipantAccess } from "@/lib/auth/participant-session";
import { prisma } from "@/lib/db/prisma";
import { buildIcs } from "@/lib/ics";

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string; eventId: string }> },
) {
  const { token, eventId } = await context.params;
  const access = await resolveParticipantAccess(token);
  if (!access) return new NextResponse("Lien invalide", { status: 401 });

  const registration = await prisma.eventRegistration.findFirst({
    where: {
      participantId: access.participant.id,
      eventId,
      event: { organizationId: access.organization.id },
    },
    include: { event: { include: { organization: true } } },
  });
  if (!registration) return new NextResponse("Introuvable", { status: 404 });
  const { event } = registration;

  const ics = buildIcs({
    uid: `${event.id}@matchmaking-events`,
    title: event.name,
    description: `Organisé par ${event.organization.name}. Votre espace : ${appBaseUrl()}/p/${token}`,
    location: [event.venueName, event.venueAddress].filter(Boolean).join(", ") || null,
    url: `${appBaseUrl()}/p/${token}/evenements/${event.id}`,
    start: event.startsAt,
    end: event.endsAt,
  });
  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="evenement.ics"`,
      "Cache-Control": "private, no-store",
    },
  });
}
