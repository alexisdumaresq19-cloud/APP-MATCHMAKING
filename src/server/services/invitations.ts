import type { Event, Organization, Participant } from "@prisma/client";
import { audit } from "@/lib/audit";
import { appBaseUrl, participantAccessUrl } from "@/lib/auth/participant-session";
import { signParticipantToken } from "@/lib/auth/participant-token";
import { formatDateRange } from "@/lib/dates";
import { prisma } from "@/lib/db/prisma";
import { emailBrandOf } from "@/lib/email/brand";
import { sendEmail } from "@/lib/email/send";
import { EventInvitationEmail } from "@/lib/email/templates/event-invitation";
import { AppError, NotFoundError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { registrationAvailability } from "@/server/queries/public";
import type { BatchProgress } from "./publication";

/**
 * « Inviter les participants passés » (D-35): every person of the organization's directory who is
 * not registered to the event receives, once, an email with a one-click registration link. People
 * who opted out (« Ne plus recevoir d'invitations ») and anonymized profiles are never contacted.
 */
export const INVITATION_TEMPLATE = "event_invitation";
/** A registration link never lives longer than this, even for a far-away event. */
const INVITATION_LINK_MAX_DAYS = 60;

export type InvitationOverview = {
  registrationOpen: boolean;
  invitable: number;
  sent: number;
  failed: number;
  optedOut: number;
  startedAt: Date | null;
};

type Actor = { actorType: "organizer" | "system"; actorId?: string | null };

type LoadedEvent = Event & { organization: Organization; activeRegistrations: number };

async function loadEvent(eventId: string, organizationId: string): Promise<LoadedEvent> {
  const event = await prisma.event.findFirst({
    where: { id: eventId, organizationId },
    include: {
      organization: true,
      _count: { select: { registrations: { where: { status: { not: "CANCELLED" } } } } },
    },
  });
  if (!event) throw new NotFoundError("Cet événement est introuvable.");
  const { _count, ...rest } = event;
  return { ...rest, activeRegistrations: _count.registrations };
}

/** Directory members who can still be invited: not registered, not opted out, not yet invited. */
async function invitableParticipants(event: Pick<Event, "id" | "organizationId">) {
  const [registered, invited] = await Promise.all([
    prisma.eventRegistration.findMany({
      where: { eventId: event.id },
      select: { participantId: true },
    }),
    prisma.emailLog.findMany({
      where: { eventId: event.id, template: INVITATION_TEMPLATE, status: "sent" },
      select: { toEmail: true },
    }),
  ]);
  const invitedEmails = new Set(invited.map((log) => log.toEmail));
  const participants = await prisma.participant.findMany({
    where: {
      organizationId: event.organizationId,
      deletedAt: null,
      invitationsOptOut: false,
      id: { notIn: registered.map((r) => r.participantId) },
    },
    orderBy: { createdAt: "asc" },
  });
  return participants.filter((participant) => !invitedEmails.has(participant.email));
}

export async function getInvitationOverview(
  eventId: string,
  organizationId: string,
): Promise<InvitationOverview> {
  const event = await loadEvent(eventId, organizationId);
  const [invitable, logs, optedOut] = await Promise.all([
    invitableParticipants(event),
    prisma.emailLog.groupBy({
      by: ["status"],
      where: { eventId, template: INVITATION_TEMPLATE },
      _count: { _all: true },
    }),
    prisma.participant.count({
      where: { organizationId, deletedAt: null, invitationsOptOut: true },
    }),
  ]);
  const count = (status: string) => logs.find((l) => l.status === status)?._count._all ?? 0;
  return {
    registrationOpen: registrationAvailability(event).open,
    invitable: invitable.length,
    sent: count("sent"),
    failed: count("failed"),
    optedOut,
    startedAt: event.invitationsStartedAt,
  };
}

/** Step 1: marks the start of a run (audited); the emails follow in batches. */
export async function startInvitations(
  eventId: string,
  organizationId: string,
  actor: Actor,
): Promise<void> {
  const event = await loadEvent(eventId, organizationId);
  if (!registrationAvailability(event).open) {
    throw new AppError(
      "Les inscriptions ne sont pas ouvertes : ouvrez l'événement avant d'envoyer des invitations.",
    );
  }
  await prisma.event.update({ where: { id: eventId }, data: { invitationsStartedAt: new Date() } });
  await audit({
    organizationId,
    actorType: actor.actorType,
    actorId: actor.actorId ?? null,
    action: "UPDATE",
    entity: "Event",
    entityId: eventId,
    metadata: { invitations: "started" },
  });
}

async function withRetry(send: () => Promise<boolean>): Promise<boolean> {
  if (await send()) return true;
  await new Promise((resolve) => setTimeout(resolve, 400));
  return send();
}

async function sendInvitation(event: LoadedEvent, participant: Participant): Promise<boolean> {
  const organization = event.organization;
  const closesAt = event.registrationClosesAt ?? event.startsAt;
  const cap = Date.now() + INVITATION_LINK_MAX_DAYS * 86_400_000;
  const floor = Date.now() + 86_400_000;
  const expiresAt = new Date(Math.max(floor, Math.min(closesAt.getTime(), cap)));
  const token = await signParticipantToken(
    {
      participantId: participant.id,
      organizationId: participant.organizationId,
      tokenVersion: participant.tokenVersion,
      purpose: "register",
      eventId: event.id,
    },
    { expiresAt },
  );
  const base = appBaseUrl();
  const eventUrl = `${base}/e/${organization.slug}/${event.slug}`;
  const spotsLeft =
    event.capacity !== null ? Math.max(0, event.capacity - event.activeRegistrations) : null;
  return sendEmail({
    organization,
    to: participant.email,
    subject: `Invitation : ${event.name}`,
    template: INVITATION_TEMPLATE,
    eventId: event.id,
    react: EventInvitationEmail({
      brand: emailBrandOf(organization),
      firstName: participant.firstName,
      organizationName: organization.name,
      eventName: event.name,
      eventDate: formatDateRange(event.startsAt, event.endsAt, organization.timezone),
      venue: [event.venueName, event.venueAddress].filter(Boolean).join(", ") || null,
      spotsLeft,
      actionUrl: `${eventUrl}/inscription-rapide?token=${encodeURIComponent(token)}`,
      eventUrl,
      optOutUrl: `${await participantAccessUrl(participant)}/invitations`,
    }),
  });
}

/** Sends the next batch of invitations; called in a loop by the Publication tab (D-28). */
export async function runInvitationBatch(
  eventId: string,
  organizationId: string,
  size: number,
): Promise<BatchProgress> {
  const event = await loadEvent(eventId, organizationId);
  if (!event.invitationsStartedAt) throw new AppError("Lancez d'abord l'envoi des invitations.");
  if (!registrationAvailability(event).open) {
    throw new AppError("Les inscriptions sont fermées : aucune invitation envoyée.");
  }
  const queue = await invitableParticipants(event);
  const batch = queue.slice(0, size);
  let sent = 0;
  let failed = 0;
  for (const participant of batch) {
    try {
      if (await withRetry(() => sendInvitation(event, participant))) sent += 1;
      else failed += 1;
    } catch (error) {
      logger.error({ err: error, participantId: participant.id }, "invitation email failed");
      failed += 1;
    }
  }
  return { sent, failed, remaining: Math.max(0, queue.length - batch.length), total: queue.length };
}
