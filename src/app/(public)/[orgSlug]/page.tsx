import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarPlusIcon, ChevronRightIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { AnimatedIcon } from "@/components/ui/animated-icon";
import { TextReveal } from "@/components/motion/text-reveal";
import { BrandProvider } from "@/components/shared/brand-provider";
import { EmptyState } from "@/components/shared/empty-state";
import { PoweredBy } from "@/components/shared/powered-by";
import { OrganizationHeader } from "@/components/public/organization-header";
import { googleCalendarUrl } from "@/lib/calendar-links";
import { formatDate, formatDateRange } from "@/lib/dates";
import { cn } from "@/lib/utils";
import {
  getOrganizationBySlug,
  listUpcomingEvents,
  registrationAvailability,
  type Availability,
} from "@/server/queries/public";

type Params = Promise<{ orgSlug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { orgSlug } = await params;
  const organization = await getOrganizationBySlug(orgSlug);
  if (!organization) return { title: "Organisation introuvable" };
  return {
    title: `Événements · ${organization.name}`,
    description: `Les prochains événements de réseautage de ${organization.name}. Inscrivez votre entreprise et rencontrez des partenaires complémentaires.`,
  };
}

function availabilityBadge(availability: Availability, timezone: string) {
  switch (availability.reason) {
    case "open":
      return {
        label: "Inscriptions ouvertes",
        className: "border-green-300 bg-green-100 text-green-900",
      };
    case "full":
      return { label: "Complet", className: "border-amber-300 bg-amber-100 text-amber-900" };
    case "not_open_yet":
      return {
        label: `Ouvre le ${formatDate(availability.opensAt, timezone, "date")}`,
        className: "",
      };
    default:
      return { label: "Inscriptions fermées", className: "" };
  }
}

/** The organization's showcase (D-35): every upcoming event, one click to register. */
export default async function OrganizationShowcasePage({ params }: { params: Params }) {
  const { orgSlug } = await params;
  const organization = await getOrganizationBySlug(orgSlug);
  if (!organization) notFound();
  const events = await listUpcomingEvents(organization.id);

  return (
    <BrandProvider colors={organization}>
      <div className="flex min-h-dvh flex-col">
        <OrganizationHeader organization={organization} />
        <main className="mx-auto w-full max-w-2xl flex-1 space-y-8 px-4 py-8 sm:px-6">
          <div>
            <TextReveal
              as="h1"
              text="Nos prochains événements"
              className="text-3xl font-bold tracking-tight sm:text-4xl"
            />
            <p className="mt-2 text-base text-muted-foreground">
              Inscrivez votre entreprise en quelques minutes : nous vous jumelons avec des
              entreprises complémentaires à la vôtre, et vous connaissez votre table avant
              d&apos;arriver.
            </p>
          </div>

          {events.length === 0 ? (
            <EmptyState
              icon="calendar-days"
              title="Aucun événement à venir pour l'instant"
              description="Revenez bientôt : la prochaine rencontre sera annoncée ici."
            />
          ) : (
            <ul className="space-y-4">
              {events.map((event) => {
                const availability = registrationAvailability(event);
                const badge = availabilityBadge(availability, organization.timezone);
                const spotsLeft =
                  event.capacity !== null
                    ? Math.max(0, event.capacity - event.activeRegistrations)
                    : null;
                const eventPath = `/e/${organization.slug}/${event.slug}`;
                const venue = [event.venueName, event.venueAddress].filter(Boolean).join(", ");
                return (
                  <li key={event.id} className="rounded-lg border bg-card p-5">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <h2 className="text-xl font-semibold">{event.name}</h2>
                      <Badge variant="outline" className={badge.className}>
                        {badge.label}
                      </Badge>
                    </div>
                    <dl className="mt-3 space-y-2 text-base">
                      <div className="flex items-start gap-3">
                        <AnimatedIcon name="calendar-days" size={20} className="mt-0.5" />
                        <div>
                          <dt className="sr-only">Date</dt>
                          <dd className="font-medium">
                            {formatDateRange(event.startsAt, event.endsAt, organization.timezone)}
                          </dd>
                        </div>
                      </div>
                      {venue ? (
                        <div className="flex items-start gap-3">
                          <AnimatedIcon name="map-pin" size={20} className="mt-0.5" />
                          <div>
                            <dt className="sr-only">Lieu</dt>
                            <dd>{venue}</dd>
                          </div>
                        </div>
                      ) : null}
                      {spotsLeft !== null && availability.open ? (
                        <div className="flex items-start gap-3">
                          <AnimatedIcon name="users" size={20} className="mt-0.5" />
                          <div>
                            <dt className="sr-only">Places</dt>
                            <dd>
                              {spotsLeft === 1
                                ? "Il reste 1 place"
                                : `Il reste ${spotsLeft} places`}
                            </dd>
                          </div>
                        </div>
                      ) : null}
                    </dl>
                    {event.description ? (
                      <p className="mt-3 line-clamp-3 text-sm whitespace-pre-line text-muted-foreground">
                        {event.description}
                      </p>
                    ) : null}
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Link
                        href={eventPath}
                        className={cn(
                          buttonVariants({ size: "lg" }),
                          availability.open && "bg-brand text-brand-foreground hover:bg-brand/90",
                        )}
                      >
                        {availability.open ? "S'inscrire" : "Voir les détails"}
                        <ChevronRightIcon aria-hidden="true" />
                      </Link>
                      <a
                        href={`${eventPath}/calendrier.ics`}
                        className={buttonVariants({ variant: "outline", size: "lg" })}
                      >
                        <CalendarPlusIcon aria-hidden="true" />
                        Ajouter à mon calendrier
                      </a>
                      <a
                        href={googleCalendarUrl({
                          title: event.name,
                          start: event.startsAt,
                          end: event.endsAt,
                          location: venue || null,
                          details: `Organisé par ${organization.name}.`,
                        })}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={buttonVariants({ variant: "outline", size: "lg" })}
                      >
                        Google Agenda
                      </a>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <p className="text-sm text-muted-foreground">
            Déjà inscrit à un événement? Utilisez le lien personnel reçu par courriel pour retrouver
            vos jumelages, votre table et les autres événements ouverts.
          </p>
        </main>
        <footer className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6">
          <div className="flex flex-col gap-2 border-t pt-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <a
              href={`/${organization.slug}/confidentialite`}
              className="underline-offset-4 hover:underline"
            >
              Confidentialité et renseignements personnels
            </a>
            <PoweredBy />
          </div>
        </footer>
      </div>
    </BrandProvider>
  );
}
