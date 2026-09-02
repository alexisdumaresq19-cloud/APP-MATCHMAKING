import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EventForm } from "@/components/admin/events/event-form";
import { EventActions } from "@/components/admin/events/event-actions";
import { PublicLinkCard } from "@/components/admin/events/public-link-card";
import { appBaseUrl } from "@/lib/auth/participant-session";
import { requireOrganizer } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { saveEvent } from "@/server/actions/events";
import { getRuleSets } from "@/server/queries/admin";

export const metadata: Metadata = { title: "Détails de l'événement" };

export default async function EventDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { organization } = await requireOrganizer();
  const [event, ruleSets] = await Promise.all([
    prisma.event.findFirst({ where: { id, organizationId: organization.id } }),
    getRuleSets(organization.id),
  ]);
  if (!event) notFound();
  const publicUrl = `${appBaseUrl()}/e/${organization.slug}/${event.slug}`;

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
      <EventForm
        action={saveEvent.bind(null, event.id)}
        initial={event}
        ruleSets={ruleSets}
        timezone={organization.timezone}
      />
      <aside className="space-y-6 lg:order-last">
        <EventActions eventId={event.id} status={event.status} />
        <PublicLinkCard
          url={publicUrl}
          qrUrl={`/admin/events/${event.id}/qr.png`}
          disabled={event.status === "DRAFT" || event.status === "ARCHIVED"}
        />
      </aside>
    </div>
  );
}
