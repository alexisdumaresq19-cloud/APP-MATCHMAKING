import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { EventStatusBadge } from "@/components/admin/events/event-status-badge";
import { EventTabs } from "@/components/admin/events/event-tabs";
import { requireOrganizer } from "@/lib/auth/session";
import { formatDateRange } from "@/lib/dates";
import { prisma } from "@/lib/db/prisma";

export default async function EventLayout({
  params,
  children,
}: {
  params: Promise<{ id: string }>;
  children: ReactNode;
}) {
  const { id } = await params;
  const { organization } = await requireOrganizer();
  const event = await prisma.event.findFirst({
    where: { id, organizationId: organization.id },
    include: { _count: { select: { registrations: { where: { status: { not: "CANCELLED" } } } } } },
  });
  if (!event) notFound();

  return (
    <>
      <div className="mb-6 space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{event.name}</h1>
          <EventStatusBadge status={event.status} />
        </div>
        <p className="text-base text-muted-foreground">
          {formatDateRange(event.startsAt, event.endsAt, organization.timezone)} ·{" "}
          {event._count.registrations}
          {event.capacity ? ` / ${event.capacity}` : ""} inscrit
          {event._count.registrations > 1 ? "s" : ""}
        </p>
      </div>
      <EventTabs eventId={event.id} />
      <div className="mt-6">{children}</div>
    </>
  );
}
