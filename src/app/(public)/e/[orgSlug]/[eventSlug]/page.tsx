import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CalendarDaysIcon, MapPinIcon, UsersIcon } from "lucide-react";
import { RegistrationForm } from "@/components/public/registration-form";
import { FormAlert } from "@/components/shared/form-field";
import { formatDate, formatDateRange } from "@/lib/dates";
import { REGIONS } from "@/lib/regions";
import { paragraphs } from "@/lib/text";
import {
  getActiveSectors,
  getPublicEvent,
  registrationAvailability,
  type Availability,
} from "@/server/queries/public";
import { registerToEvent } from "@/server/actions/register";
import { getTagSuggestions } from "@/server/queries/tags";
import { suggestedSectorsMap } from "@/server/services/sought-sectors";

type Params = Promise<{ orgSlug: string; eventSlug: string }>;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ orgSlug: string; eventSlug: string }>;
}): Promise<Metadata> {
  const { orgSlug, eventSlug } = await params;
  const event = await getPublicEvent(orgSlug, eventSlug);
  if (!event) return { title: "Événement introuvable" };
  return {
    title: `${event.name} · ${event.organization.platformName}`,
    description: event.description?.slice(0, 160) ?? `Inscription à ${event.name}`,
  };
}

function availabilityMessage(availability: Availability, timezone: string): string {
  switch (availability.reason) {
    case "not_open_yet":
      return `Les inscriptions ouvriront le ${formatDate(availability.opensAt, timezone, "long")}.`;
    case "full":
      return "Cet événement est complet. Merci de votre intérêt!";
    case "completed":
      return "Cet événement est terminé. Merci à toutes les personnes qui y ont participé!";
    case "archived":
      return "Cet événement n'est plus disponible.";
    default:
      return "Les inscriptions à cet événement sont fermées.";
  }
}

export default async function PublicEventPage({ params }: { params: Params }) {
  const { orgSlug, eventSlug } = await params;
  const event = await getPublicEvent(orgSlug, eventSlug);
  if (!event || event.status === "DRAFT") notFound();

  const { organization } = event;
  const availability = registrationAvailability(event);
  const [sectors, tagSuggestions, suggestedSectors] = availability.open
    ? await Promise.all([
        getActiveSectors(organization.id),
        getTagSuggestions(organization.id),
        suggestedSectorsMap(organization.id),
      ])
    : [[], [], {}];
  const description = paragraphs(event.description);
  const mapsUrl = event.venueAddress
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.venueAddress)}`
    : null;
  const spotsLeft =
    event.capacity !== null ? Math.max(0, event.capacity - event.activeRegistrations) : null;

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{event.name}</h1>
        <dl className="space-y-3 text-base">
          <div className="flex items-start gap-3">
            <CalendarDaysIcon className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden="true" />
            <div>
              <dt className="sr-only">Date</dt>
              <dd className="font-medium">
                {formatDateRange(event.startsAt, event.endsAt, organization.timezone)}
              </dd>
            </div>
          </div>
          {event.venueName || event.venueAddress ? (
            <div className="flex items-start gap-3">
              <MapPinIcon className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden="true" />
              <div>
                <dt className="sr-only">Lieu</dt>
                <dd>
                  {event.venueName ? <span className="font-medium">{event.venueName}</span> : null}
                  {event.venueName && event.venueAddress ? <br /> : null}
                  {event.venueAddress ? (
                    mapsUrl ? (
                      <a
                        href={mapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-brand underline underline-offset-4"
                      >
                        {event.venueAddress}
                      </a>
                    ) : (
                      event.venueAddress
                    )
                  ) : null}
                </dd>
              </div>
            </div>
          ) : null}
          {spotsLeft !== null && availability.open ? (
            <div className="flex items-start gap-3">
              <UsersIcon className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden="true" />
              <div>
                <dt className="sr-only">Places</dt>
                <dd>{spotsLeft === 1 ? "Il reste 1 place" : `Il reste ${spotsLeft} places`}</dd>
              </div>
            </div>
          ) : null}
        </dl>
        {description.length ? (
          <div className="space-y-3 text-base leading-relaxed text-foreground/90">
            {description.map((p, index) => (
              <p key={index} className="whitespace-pre-line">
                {p}
              </p>
            ))}
          </div>
        ) : null}
      </section>

      <section id="inscription" className="scroll-mt-6 space-y-4">
        {availability.open ? (
          <>
            <div>
              <h2 className="text-2xl font-bold tracking-tight">S'inscrire</h2>
              <p className="mt-1 text-muted-foreground">
                Trois courtes étapes. Vos réponses servent à vous jumeler avec des entreprises
                complémentaires à la vôtre.
              </p>
            </div>
            <RegistrationForm
              action={registerToEvent.bind(null, orgSlug, eventSlug)}
              sectors={sectors}
              regions={REGIONS}
              consentText={organization.consentText}
              privacyEmail={organization.privacyEmail}
              organizationName={organization.name}
              tagSuggestions={tagSuggestions}
              suggestedSectors={suggestedSectors}
            />
          </>
        ) : (
          <FormAlert
            variant="info"
            message={availabilityMessage(availability, organization.timezone)}
          />
        )}
      </section>
    </div>
  );
}
