import { NextResponse } from "next/server";
import { appBaseUrl } from "@/lib/auth/participant-session";
import { buildIcs } from "@/lib/ics";
import { getPublicEvent } from "@/server/queries/public";

/** Public "Ajouter à mon calendrier" file (Apple, Outlook…), no registration required. */
export async function GET(
  _request: Request,
  context: { params: Promise<{ orgSlug: string; eventSlug: string }> },
) {
  const { orgSlug, eventSlug } = await context.params;
  const event = await getPublicEvent(orgSlug, eventSlug);
  if (!event || event.status === "DRAFT" || event.status === "ARCHIVED") {
    return new NextResponse("Introuvable", { status: 404 });
  }
  const pageUrl = `${appBaseUrl()}/e/${orgSlug}/${eventSlug}`;
  const ics = buildIcs({
    uid: `${event.id}@matchmaking-events`,
    title: event.name,
    description: `Organisé par ${event.organization.name}. Inscription : ${pageUrl}`,
    location: [event.venueName, event.venueAddress].filter(Boolean).join(", ") || null,
    url: pageUrl,
    start: event.startsAt,
    end: event.endsAt,
  });
  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${eventSlug}.ics"`,
      "Cache-Control": "public, max-age=300",
    },
  });
}
