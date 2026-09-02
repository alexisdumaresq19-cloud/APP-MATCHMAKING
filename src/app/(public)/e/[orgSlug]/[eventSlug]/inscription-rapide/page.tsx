import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FormAlert } from "@/components/shared/form-field";
import { QuickRegistrationForm } from "@/components/public/quick-registration-form";
import { resolveRegisterToken } from "@/lib/auth/participant-session";
import { formatDateRange } from "@/lib/dates";
import { quickRegister } from "@/server/actions/register";
import { getPublicEvent, registrationAvailability } from "@/server/queries/public";
import { currentConsentVersion, hasCurrentConsent } from "@/server/services/consent";

export const metadata: Metadata = { title: "Inscription rapide" };

export default async function QuickRegistrationPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string; eventSlug: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { orgSlug, eventSlug } = await params;
  const { token = "" } = await searchParams;
  const event = await getPublicEvent(orgSlug, eventSlug);
  if (!event || event.status === "DRAFT") notFound();

  const participant = await resolveRegisterToken(token, event.id);
  const eventPath = `/e/${orgSlug}/${eventSlug}`;

  if (!participant) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">Ce lien n'est plus valide</h1>
        <p className="text-base text-muted-foreground">
          Les liens d'inscription rapide expirent après quelques jours. Vous pouvez vous inscrire à
          nouveau depuis la page de l'événement : nous vous enverrons un nouveau lien.
        </p>
        <Link href={eventPath} className="inline-block text-brand underline underline-offset-4">
          Aller à la page de l'événement
        </Link>
      </div>
    );
  }

  const availability = registrationAvailability(event);
  const needsConsent = !(await hasCurrentConsent(
    participant.id,
    currentConsentVersion(event.organization),
  ));

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Bonjour {participant.firstName}, inscrivez-vous en un clic
        </h1>
        <p className="text-base text-muted-foreground">
          <strong className="text-foreground">{event.name}</strong> ·{" "}
          {formatDateRange(event.startsAt, event.endsAt, event.organization.timezone)}
        </p>
      </div>

      <section className="rounded-lg border bg-card p-4">
        <h2 className="mb-3 text-base font-semibold">Votre profil actuel</h2>
        <dl className="grid gap-2 text-base sm:grid-cols-[auto_1fr] sm:gap-x-6">
          <dt className="text-muted-foreground">Entreprise</dt>
          <dd>{participant.companyName}</dd>
          <dt className="text-muted-foreground">Secteur</dt>
          <dd>{participant.sector?.name ?? "—"}</dd>
          <dt className="text-muted-foreground">Région</dt>
          <dd>{[participant.city, participant.region].filter(Boolean).join(", ") || "—"}</dd>
          <dt className="text-muted-foreground">Vous offrez</dt>
          <dd>{participant.offers.join(", ") || "—"}</dd>
          <dt className="text-muted-foreground">Vous cherchez</dt>
          <dd>{participant.needs.join(", ") || "—"}</dd>
        </dl>
        <p className="mt-3 text-sm text-muted-foreground">
          Vous pourrez mettre votre profil à jour depuis votre espace personnel après l'inscription.
        </p>
      </section>

      {availability.open ? (
        <QuickRegistrationForm
          action={quickRegister.bind(null, orgSlug, eventSlug, token)}
          needsConsent={needsConsent}
          consentText={event.organization.consentText}
        />
      ) : (
        <FormAlert variant="info" message="Les inscriptions à cet événement sont fermées." />
      )}
    </div>
  );
}
