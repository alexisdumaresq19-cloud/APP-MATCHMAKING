import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDaysIcon, ChevronRightIcon, MapPinIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/empty-state";
import { FormAlert } from "@/components/shared/form-field";
import { resolveParticipantAccess } from "@/lib/auth/participant-session";
import { formatDateRange } from "@/lib/dates";
import { prisma } from "@/lib/db/prisma";
import { currentConsentVersion, hasCurrentConsent } from "@/server/services/consent";
import { registrationStatusLabel } from "@/lib/labels";

export default async function ParticipantHomePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const context = await resolveParticipantAccess(token);
  if (!context) notFound();
  const { participant, organization } = context;

  const registrations = await prisma.eventRegistration.findMany({
    where: { participantId: participant.id, event: { status: { not: "ARCHIVED" } } },
    include: { event: true },
    orderBy: { event: { startsAt: "desc" } },
  });
  const now = new Date();
  const upcoming = registrations.filter((r) => (r.event.endsAt ?? r.event.startsAt) >= now);
  const past = registrations.filter((r) => (r.event.endsAt ?? r.event.startsAt) < now);
  const consentOk = await hasCurrentConsent(participant.id, currentConsentVersion(organization));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Bonjour {participant.firstName}
        </h1>
        <p className="mt-1 text-base text-muted-foreground">
          {participant.companyName}
          {participant.sector ? ` · ${participant.sector.name}` : ""}
        </p>
      </div>

      {!consentOk ? (
        <FormAlert
          variant="info"
          message="Votre consentement à l'avis de confidentialité est requis pour participer au jumelage. Ouvrez un événement ci-dessous pour le lire et l'accepter."
        />
      ) : null}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Événements à venir</h2>
        {upcoming.length === 0 ? (
          <EmptyState
            icon="calendar-days"
            size="sm"
            title="Aucun événement à venir pour l'instant"
            description="Vous recevrez un courriel dès qu'une nouvelle rencontre sera ouverte."
          />
        ) : (
          <ul className="space-y-3">
            {upcoming.map((registration) => (
              <li key={registration.id}>
                <EventCard
                  token={token}
                  registration={registration}
                  timezone={organization.timezone}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {past.length ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Événements passés</h2>
          <ul className="space-y-3">
            {past.map((registration) => (
              <li key={registration.id}>
                <EventCard
                  token={token}
                  registration={registration}
                  timezone={organization.timezone}
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function EventCard({
  token,
  registration,
  timezone,
}: {
  token: string;
  registration: {
    id: string;
    status: "REGISTERED" | "CONFIRMED" | "CHECKED_IN" | "CANCELLED" | "NO_SHOW";
    event: {
      id: string;
      name: string;
      startsAt: Date;
      endsAt: Date | null;
      venueName: string | null;
      publishedAt: Date | null;
    };
  };
  timezone: string;
}) {
  const { event } = registration;
  return (
    <Link
      href={`/p/${token}/evenements/${event.id}`}
      className="flex items-center gap-4 rounded-lg border bg-card p-4 transition-colors hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <div className="min-w-0 flex-1 space-y-1">
        <p className="truncate text-base font-semibold">{event.name}</p>
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <CalendarDaysIcon className="size-4 shrink-0" aria-hidden="true" />
          {formatDateRange(event.startsAt, event.endsAt, timezone)}
        </p>
        {event.venueName ? (
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <MapPinIcon className="size-4 shrink-0" aria-hidden="true" />
            {event.venueName}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2 pt-1">
          <Badge variant="secondary">{registrationStatusLabel(registration.status)}</Badge>
          {event.publishedAt ? (
            <Badge className="bg-brand text-brand-foreground">Jumelages disponibles</Badge>
          ) : null}
        </div>
      </div>
      <ChevronRightIcon className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
    </Link>
  );
}
