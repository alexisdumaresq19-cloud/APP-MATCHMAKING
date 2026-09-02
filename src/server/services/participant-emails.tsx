import type { Event, Organization, Participant } from "@prisma/client";
import { formatDateRange } from "@/lib/dates";
import { emailBrandOf } from "@/lib/email/brand";
import { sendEmail } from "@/lib/email/send";
import { ConsentPendingEmail } from "@/lib/email/templates/consent-pending";
import { ExistingProfileLinkEmail } from "@/lib/email/templates/existing-profile-link";
import { ParticipantLinkEmail } from "@/lib/email/templates/participant-link";
import { RegistrationConfirmedEmail } from "@/lib/email/templates/registration-confirmed";
import { participantAccessUrl } from "@/lib/auth/participant-session";

type EventSummary = Pick<
  Event,
  "id" | "name" | "startsAt" | "endsAt" | "venueName" | "venueAddress"
>;

function venueLine(event: EventSummary): string | null {
  return [event.venueName, event.venueAddress].filter(Boolean).join(", ") || null;
}

export async function sendRegistrationConfirmed(input: {
  organization: Organization;
  event: EventSummary;
  participant: Participant;
  sectorName: string | null;
  offers: string[];
  needs: string[];
  soughtSectorNames?: string[];
}): Promise<boolean> {
  const { organization, event, participant } = input;
  const participantUrl = await participantAccessUrl(participant);
  return sendEmail({
    organization,
    to: participant.email,
    subject: `Votre inscription à ${event.name} est confirmée`,
    template: "registration_confirmed",
    eventId: event.id,
    react: (
      <RegistrationConfirmedEmail
        brand={emailBrandOf(organization)}
        firstName={participant.firstName}
        eventName={event.name}
        eventDate={formatDateRange(event.startsAt, event.endsAt, organization.timezone)}
        venue={venueLine(event)}
        companyName={participant.companyName}
        sectorName={input.sectorName}
        offers={input.offers}
        needs={input.needs}
        soughtSectorNames={input.soughtSectorNames ?? []}
        participantUrl={participantUrl}
      />
    ),
  });
}

export async function sendExistingProfileLink(input: {
  organization: Organization;
  event: EventSummary;
  participant: Participant;
  alreadyRegistered: boolean;
  actionUrl: string;
}): Promise<boolean> {
  const { organization, event, participant } = input;
  return sendEmail({
    organization,
    to: participant.email,
    subject: input.alreadyRegistered
      ? `Vous êtes déjà inscrit à ${event.name}`
      : `Inscrivez-vous à ${event.name} avec votre profil`,
    template: "existing_profile_link",
    eventId: event.id,
    react: (
      <ExistingProfileLinkEmail
        brand={emailBrandOf(organization)}
        firstName={participant.firstName}
        eventName={event.name}
        alreadyRegistered={input.alreadyRegistered}
        actionUrl={input.actionUrl}
      />
    ),
  });
}

export async function sendConsentPending(input: {
  organization: Organization;
  event: EventSummary;
  participant: Participant;
}): Promise<boolean> {
  const { organization, event, participant } = input;
  const participantUrl = await participantAccessUrl(participant);
  return sendEmail({
    organization,
    to: participant.email,
    subject: `Confirmez votre inscription à ${event.name}`,
    template: "consent_pending",
    eventId: event.id,
    react: (
      <ConsentPendingEmail
        brand={emailBrandOf(organization)}
        firstName={participant.firstName}
        eventName={event.name}
        eventDate={formatDateRange(event.startsAt, event.endsAt, organization.timezone)}
        participantUrl={participantUrl}
      />
    ),
  });
}

export async function sendParticipantLink(input: {
  organization: Organization;
  participant: Participant;
}): Promise<boolean> {
  const { organization, participant } = input;
  const participantUrl = await participantAccessUrl(participant);
  return sendEmail({
    organization,
    to: participant.email,
    subject: "Votre lien d'accès personnel",
    template: "participant_link",
    react: (
      <ParticipantLinkEmail
        brand={emailBrandOf(organization)}
        firstName={participant.firstName}
        participantUrl={participantUrl}
      />
    ),
  });
}
