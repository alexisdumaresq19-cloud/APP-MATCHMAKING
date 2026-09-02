import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeftIcon, CalendarDaysIcon, MapPinIcon } from "lucide-react";
import { QuickRegistrationForm } from "@/components/public/quick-registration-form";
import { FormAlert } from "@/components/shared/form-field";
import { resolveParticipantAccess } from "@/lib/auth/participant-session";
import { formatDateRange } from "@/lib/dates";
import { prisma } from "@/lib/db/prisma";
import { registerFromSpace } from "@/server/actions/participant-events";
import { registrationAvailability } from "@/server/queries/public";
import { currentConsentVersion, hasCurrentConsent } from "@/server/services/consent";

export const metadata: Metadata = { title: "M'inscrire" };

/** One-click registration to another open event of the organization (D-35). */
export default async function ParticipantRegisterPage({
  params,
}: {
  params: Promise<{ token: string; eventId: string }>;
}) {
  const { token, eventId } = await params;
  const context = await resolveParticipantAccess(token);
  if (!context) notFound();
  const { participant, organization } = context;

  const event = await prisma.event.findFirst({
    where: {
      id: eventId,
      organizationId: organization.id,
      status: { notIn: ["DRAFT", "ARCHIVED"] },
    },
    include: {
      _count: { select: { registrations: { where: { status: { not: "CANCELLED" } } } } },
    },
  });
  if (!event) notFound();
  const existing = await prisma.eventRegistration.findUnique({
    where: { eventId_participantId: { eventId, participantId: participant.id } },
  });
  if (existing && existing.status !== "CANCELLED") redirect(`/p/${token}/evenements/${eventId}`);

  const availability = registrationAvailability({
    ...event,
    activeRegistrations: event._count.registrations,
  });
  const needsConsent = !(await hasCurrentConsent(
    participant.id,
    currentConsentVersion(organization),
  ));
  const venue = [event.venueName, event.venueAddress].filter(Boolean).join(", ");

  return (
    <div className="space-y-6">
      <Link
        href={`/p/${token}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" aria-hidden="true" />
        Mes événements
      </Link>
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Inscrivez-vous en un clic</h1>
        <p className="text-lg font-semibold">{event.name}</p>
        <p className="flex items-center gap-1.5 text-base text-muted-foreground">
          <CalendarDaysIcon className="size-4 shrink-0" aria-hidden="true" />
          {formatDateRange(event.startsAt, event.endsAt, organization.timezone)}
        </p>
        {venue ? (
          <p className="flex items-center gap-1.5 text-base text-muted-foreground">
            <MapPinIcon className="size-4 shrink-0" aria-hidden="true" />
            {venue}
          </p>
        ) : null}
      </div>

      <section className="rounded-lg border bg-card p-4">
        <h2 className="mb-3 text-base font-semibold">Votre profil actuel</h2>
        <dl className="grid gap-2 text-base sm:grid-cols-[auto_1fr] sm:gap-x-6">
          <dt className="text-muted-foreground">Entreprise</dt>
          <dd>{participant.companyName}</dd>
          <dt className="text-muted-foreground">Secteur</dt>
          <dd>{participant.sector?.name ?? "—"}</dd>
          <dt className="text-muted-foreground">Vous offrez</dt>
          <dd>{participant.offers.join(", ") || "—"}</dd>
          <dt className="text-muted-foreground">Vous cherchez</dt>
          <dd>{participant.needs.join(", ") || "—"}</dd>
        </dl>
        <p className="mt-3 text-sm text-muted-foreground">
          Besoin d&apos;une retouche?{" "}
          <Link href={`/p/${token}/profil`} className="text-brand underline underline-offset-4">
            Modifier mon profil
          </Link>{" "}
          avant de confirmer.
        </p>
      </section>

      {availability.open ? (
        <QuickRegistrationForm
          action={registerFromSpace.bind(null, token, eventId)}
          needsConsent={needsConsent}
          consentText={organization.consentText}
        />
      ) : (
        <FormAlert variant="info" message="Les inscriptions à cet événement sont fermées." />
      )}
    </div>
  );
}
