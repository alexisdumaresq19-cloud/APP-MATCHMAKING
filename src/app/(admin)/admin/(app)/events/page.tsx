import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/shared/empty-state";
import { CalendarPlusIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/admin/page-header";
import { EventStatusBadge } from "@/components/admin/events/event-status-badge";
import { requireOrganizer } from "@/lib/auth/session";
import { formatDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { listEvents, type EventFilter } from "@/server/queries/admin";

export const metadata: Metadata = { title: "Événements" };

const FILTERS: { value: EventFilter; label: string }[] = [
  { value: "upcoming", label: "À venir" },
  { value: "past", label: "Passés" },
  { value: "all", label: "Tous" },
];

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ filtre?: string }>;
}) {
  const { organization } = await requireOrganizer();
  const { filtre } = await searchParams;
  const filter: EventFilter = filtre === "past" || filtre === "all" ? filtre : "upcoming";
  const events = await listEvents(organization.id, filter);

  return (
    <>
      <PageHeader
        title="Événements"
        actions={
          <Link href="/admin/events/new" className={buttonVariants({ size: "lg" })}>
            <CalendarPlusIcon aria-hidden="true" />
            Nouvel événement
          </Link>
        }
      />
      <div className="mb-4 flex gap-2" role="tablist" aria-label="Filtre">
        {FILTERS.map((item) => (
          <Link
            key={item.value}
            href={`/admin/events?filtre=${item.value}`}
            role="tab"
            aria-selected={filter === item.value}
            className={cn(
              buttonVariants({
                variant: filter === item.value ? "default" : "outline",
                size: "sm",
              }),
              "min-h-9",
            )}
          >
            {item.label}
          </Link>
        ))}
      </div>
      {events.length === 0 ? (
        <EmptyState
          icon="calendar-plus"
          title="Aucun événement dans cette liste"
          description="Un événement, c'est une date, un lieu et des tables. Le reste suit."
          action={
            <Link href="/admin/events/new" className={buttonVariants({ size: "lg" })}>
              Créer un événement
            </Link>
          }
        />
      ) : (
        <ul className="divide-y rounded-lg border bg-card">
          {events.map((event) => (
            <li key={event.id}>
              <Link
                href={`/admin/events/${event.id}/details`}
                className="flex flex-col gap-2 px-4 py-4 hover:bg-muted/50 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 space-y-1">
                  <p className="truncate text-base font-semibold">{event.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(event.startsAt, organization.timezone, "long")}
                    {event.venueName ? ` · ${event.venueName}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-3 text-sm">
                  <span>
                    <strong>{event._count.registrations}</strong>
                    {event.capacity ? ` / ${event.capacity}` : ""} inscrit
                    {event._count.registrations > 1 ? "s" : ""}
                  </span>
                  <EventStatusBadge status={event.status} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
