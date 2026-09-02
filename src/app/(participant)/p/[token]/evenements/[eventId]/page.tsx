import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeftIcon,
  CalendarPlusIcon,
  ExternalLinkIcon,
  MapPinIcon,
  TicketIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { FormAlert } from "@/components/shared/form-field";
import { ConsentForm } from "@/components/participant/consent-form";
import { MatchCards, SeatCards } from "@/components/participant/event-view";
import { TextReveal } from "@/components/motion/text-reveal";
import { resolveParticipantAccess } from "@/lib/auth/participant-session";
import { googleCalendarUrl } from "@/lib/calendar-links";
import { formatDate, formatDateRange } from "@/lib/dates";
import { prisma } from "@/lib/db/prisma";
import { registrationStatusLabel } from "@/lib/labels";
import { paragraphs } from "@/lib/text";
import { acceptConsent } from "@/server/actions/participant";
import { currentConsentVersion, hasCurrentConsent } from "@/server/services/consent";
import { getParticipantEventView } from "@/server/queries/participant";

export const metadata: Metadata = { title: "Événement" };

export default async function ParticipantEventPage({
  params,
}: {
  params: Promise<{ token: string; eventId: string }>;
}) {
  const { token, eventId } = await params;
  const context = await resolveParticipantAccess(token);
  if (!context) notFound();
  const { participant, organization } = context;

  const registration = await prisma.eventRegistration.findFirst({
    where: { participantId: participant.id, eventId, event: { organizationId: organization.id } },
    include: { event: true },
  });
  if (!registration) notFound();
  const { event } = registration;
  const consentOk = await hasCurrentConsent(participant.id, currentConsentVersion(organization));
  const mapsUrl = event.venueAddress
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.venueAddress)}`
    : null;
  const isPast = (event.endsAt ?? event.startsAt) < new Date();
  const calendarUrl = googleCalendarUrl({
    title: event.name,
    start: event.startsAt,
    end: event.endsAt,
    location: [event.venueName, event.venueAddress].filter(Boolean).join(", ") || null,
    details: `Organisé par ${organization.name}.`,
  });
  const view =
    registration.status === "CANCELLED"
      ? { matches: [], seats: [], published: false }
      : await getParticipantEventView(registration, event);

  return (
    <div className="space-y-8">
      <Link
        href={`/p/${token}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" aria-hidden="true" />
        Mes événements
      </Link>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{registrationStatusLabel(registration.status)}</Badge>
          {registration.status === "CANCELLED" ? null : isPast ? (
            <Badge variant="outline">Terminé</Badge>
          ) : null}
        </div>
        <TextReveal
          as="h1"
          text={event.name}
          className="text-2xl font-bold tracking-tight sm:text-3xl"
        />
        <p className="text-base">
          {formatDateRange(event.startsAt, event.endsAt, organization.timezone)}
        </p>
        {event.venueName || event.venueAddress ? (
          <p className="flex items-start gap-2 text-base">
            <MapPinIcon className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden="true" />
            <span>
              {event.venueName ? <span className="font-medium">{event.venueName}</span> : null}
              {event.venueName && event.venueAddress ? <br /> : null}
              {event.venueAddress ? (
                <a
                  href={mapsUrl ?? "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand underline underline-offset-4"
                >
                  {event.venueAddress}
                </a>
              ) : null}
            </span>
          </p>
        ) : null}
        {!isPast && registration.status !== "CANCELLED" ? (
          <div className="flex flex-wrap gap-2">
            {event.ticketUrl ? (
              <a
                href={event.ticketUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-brand px-4 text-base font-medium text-brand-foreground hover:opacity-90"
              >
                <TicketIcon className="size-5" aria-hidden="true" />
                Acheter mon billet
                <ExternalLinkIcon className="size-4 opacity-70" aria-hidden="true" />
              </a>
            ) : null}
            <a
              href={`/p/${token}/evenements/${event.id}/calendrier.ics`}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg border px-4 text-base font-medium hover:bg-muted"
            >
              <CalendarPlusIcon className="size-5" aria-hidden="true" />
              Ajouter à mon calendrier
            </a>
            <a
              href={calendarUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center gap-2 rounded-lg border px-4 text-base font-medium hover:bg-muted"
            >
              Google Agenda
            </a>
          </div>
        ) : null}
      </section>

      {!consentOk && registration.status !== "CANCELLED" ? (
        <section className="space-y-3 rounded-lg border border-brand/40 bg-brand/5 p-4">
          <h2 className="text-lg font-semibold">Votre consentement est requis</h2>
          <p className="text-base text-muted-foreground">
            Pour être jumelé avec d'autres participants, veuillez lire l'avis ci-dessous et
            confirmer votre consentement.
          </p>
          <ConsentForm
            action={acceptConsent.bind(null, token, event.id)}
            consentText={organization.consentText}
          />
        </section>
      ) : null}

      {view.published ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Ma table</h2>
          <SeatCards
            seats={view.seats}
            roundCount={event.roundCount}
            timezone={organization.timezone}
          />
        </section>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">
          Mes jumelages
          {view.matches.length ? (
            <span className="ml-2 text-base font-normal text-muted-foreground">
              {view.matches.length}
            </span>
          ) : null}
        </h2>
        {registration.status === "CANCELLED" ? (
          <FormAlert variant="info" message="Votre inscription à cet événement a été annulée." />
        ) : view.published ? (
          <>
            {registration.status !== "CHECKED_IN" && view.matches.length ? (
              <p className="text-sm text-muted-foreground">
                Les coordonnées de vos jumelages apparaîtront ici une fois que vous serez tous les
                deux arrivés à l'événement.
              </p>
            ) : null}
            <MatchCards matches={view.matches} />
          </>
        ) : (
          <FormAlert
            variant="info"
            message={`Vos jumelages seront disponibles avant l'événement, au plus tard le ${formatDate(event.startsAt, organization.timezone, "date")}. Vous recevrez un courriel.`}
          />
        )}
      </section>

      {paragraphs(event.description).length ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">À propos de l'événement</h2>
          <div className="space-y-3 text-base leading-relaxed text-foreground/90">
            {paragraphs(event.description).map((p, index) => (
              <p key={index} className="whitespace-pre-line">
                {p}
              </p>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
