import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CheckinBoard } from "@/components/admin/checkin/checkin-board";
import { EventStatusBadge } from "@/components/admin/events/event-status-badge";
import { requireOrganizer } from "@/lib/auth/session";
import { formatDateRange } from "@/lib/dates";
import { prisma } from "@/lib/db/prisma";
import { getSectors } from "@/server/queries/admin";
import { listCheckinRows } from "@/server/queries/checkin";

export const metadata: Metadata = { title: "Accueil des participants" };

/** Tablet mode at the door: no sidebar, big search, big buttons (S3-06). */
export default async function KioskCheckinPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { organization } = await requireOrganizer();
  const event = await prisma.event.findFirst({ where: { id, organizationId: organization.id } });
  if (!event) notFound();
  const [rows, sectors] = await Promise.all([listCheckinRows(id), getSectors(organization.id)]);
  const completed = event.status === "COMPLETED" || event.status === "ARCHIVED";

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <header className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm text-muted-foreground">{organization.platformName}</p>
          <h1 className="truncate text-2xl font-bold tracking-tight">{event.name}</h1>
          <p className="text-sm text-muted-foreground">
            {formatDateRange(event.startsAt, event.endsAt, organization.timezone)}
          </p>
        </div>
        <EventStatusBadge status={event.status} />
      </header>
      <CheckinBoard
        eventId={id}
        eventName={event.name}
        rows={rows}
        sectors={sectors.filter((s) => s.isActive)}
        completed={completed}
        kiosk
      />
    </div>
  );
}
