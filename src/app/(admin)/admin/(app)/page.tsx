import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRightIcon, CalendarPlusIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AnimatedIcon } from "@/components/ui/animated-icon";
import { EmptyState } from "@/components/shared/empty-state";
import { StatCard } from "@/components/shared/stat-card";
import { PageHeader } from "@/components/admin/page-header";
import { EventStatusBadge } from "@/components/admin/events/event-status-badge";
import { requireOrganizer } from "@/lib/auth/session";
import { formatDateRange } from "@/lib/dates";
import { getDashboardData, listEvents } from "@/server/queries/admin";

export const metadata: Metadata = { title: "Tableau de bord" };

export default async function DashboardPage() {
  const { organization, organizer } = await requireOrganizer();
  const [data, events] = await Promise.all([
    getDashboardData(organization.id),
    listEvents(organization.id, "upcoming"),
  ]);
  const tasks: { label: string; href: string }[] = [];
  if (data.missingSector > 0) {
    tasks.push({
      label: `${data.missingSector} inscrit${data.missingSector > 1 ? "s" : ""} sans secteur d'activité`,
      href: "/admin/events",
    });
  }
  for (const event of data.toMatch)
    tasks.push({
      label: `Matching pas encore lancé pour « ${event.name} »`,
      href: `/admin/events/${event.id}/matching`,
    });
  for (const event of data.toPublish)
    tasks.push({
      label: `Publication non envoyée pour « ${event.name} »`,
      href: `/admin/events/${event.id}/publication`,
    });

  return (
    <>
      <PageHeader
        title={`Bonjour ${organizer.name.split(" ")[0]}`}
        description="Voici l'état de vos événements."
        actions={
          <Link href="/admin/events/new" className={buttonVariants({ size: "lg" })}>
            <CalendarPlusIcon aria-hidden="true" />
            Nouvel événement
          </Link>
        }
      />
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="al-group md:col-span-2">
          <CardHeader className="flex flex-row items-start justify-between gap-3">
            <div className="min-w-0 space-y-1.5">
              <CardDescription>Prochain événement</CardDescription>
              <CardTitle className="text-xl">
                {data.nextEvent ? data.nextEvent.name : "Aucun événement à venir"}
              </CardTitle>
            </div>
            <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand/10">
              <AnimatedIcon
                name={data.nextEvent ? "calendar-check" : "calendar-plus"}
                size={22}
                play
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.nextEvent ? (
              <>
                <p className="text-base">
                  {formatDateRange(
                    data.nextEvent.startsAt,
                    data.nextEvent.endsAt,
                    organization.timezone,
                  )}
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <EventStatusBadge status={data.nextEvent.status} />
                  <span className="text-base">
                    <strong>{data.nextEvent._count.registrations}</strong>
                    {data.nextEvent.capacity ? ` / ${data.nextEvent.capacity}` : ""} inscrit
                    {data.nextEvent._count.registrations > 1 ? "s" : ""}
                  </span>
                </div>
                <Link
                  href={`/admin/events/${data.nextEvent.id}/details`}
                  className="inline-flex items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline"
                >
                  Gérer l'événement
                  <ArrowRightIcon className="size-4" aria-hidden="true" />
                </Link>
              </>
            ) : (
              <p className="text-base text-muted-foreground">
                Créez un événement pour commencer à recevoir des inscriptions.
              </p>
            )}
          </CardContent>
        </Card>
        <div className="grid gap-4">
          <StatCard
            icon="trending-up"
            label="Inscriptions (7 derniers jours)"
            value={data.recentRegistrations}
          />
          <StatCard icon="calendar-days" label="Événements à venir" value={data.upcomingCount} />
        </div>
      </div>

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>À faire</CardTitle>
          </CardHeader>
          <CardContent>
            {tasks.length === 0 ? (
              <EmptyState
                icon="circle-check"
                size="sm"
                title="Tout est à jour!"
                description="Rien à signaler pour l'instant."
              />
            ) : (
              <ul className="space-y-2">
                {tasks.map((task) => (
                  <li key={task.label}>
                    <Link
                      href={task.href}
                      className="flex min-h-10 items-center justify-between gap-3 rounded-lg border px-3 text-base hover:bg-muted"
                    >
                      <span>{task.label}</span>
                      <ArrowRightIcon
                        className="size-4 shrink-0 text-muted-foreground"
                        aria-hidden="true"
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Événements à venir</CardTitle>
          </CardHeader>
          <CardContent>
            {events.length === 0 ? (
              <EmptyState
                icon="calendar-plus"
                size="sm"
                title="Aucun événement à venir"
                description="Créez votre prochain événement pour ouvrir les inscriptions."
                action={
                  <Link href="/admin/events/new" className={buttonVariants({ variant: "outline" })}>
                    Créer un événement
                  </Link>
                }
              />
            ) : (
              <ul className="divide-y">
                {events.slice(0, 6).map((event) => (
                  <li key={event.id}>
                    <Link
                      href={`/admin/events/${event.id}/details`}
                      className="flex min-h-12 items-center justify-between gap-3 py-2 hover:underline"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{event.name}</span>
                        <span className="block text-sm text-muted-foreground">
                          {formatDateRange(event.startsAt, event.endsAt, organization.timezone)}
                        </span>
                      </span>
                      <Badge variant="secondary">
                        {event._count.registrations} inscrit
                        {event._count.registrations > 1 ? "s" : ""}
                      </Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>
    </>
  );
}
