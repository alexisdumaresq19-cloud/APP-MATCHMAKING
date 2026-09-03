import type { Event, Organization } from "@prisma/client";
import { audit } from "@/lib/audit";
import { formatDate } from "@/lib/dates";
import { prisma } from "@/lib/db/prisma";
import { AppError, NotFoundError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { describeMatch, type MatchReasons } from "@/lib/matching";
import { matchesFingerprint } from "@/lib/publication";
import { roundStartsAt, tableName } from "@/lib/rounds";
import type { PublishedMatch, PublishedSeat } from "@/lib/email/templates/matches-published";
import { currentConsentVersion } from "./consent";
import { eventSurveySummary, runSurveyBatch, type SurveySummary } from "./feedback";
import { getInvitationOverview, runInvitationBatch, type InvitationOverview } from "./invitations";
import { sendConsentPending, sendMatchesPublished, sendReminder } from "./participant-emails";

export const EMAIL_BATCH_SIZE = 20;

export type EmailBatchKind = "publish" | "reminder" | "consent" | "invite" | "survey";

export type BatchProgress = {
  sent: number;
  failed: number;
  remaining: number;
  total: number;
};

export type PublicationOverview = {
  status: Event["status"];
  publishedAt: Date | null;
  reminderSentAt: Date | null;
  totalMatches: number;
  seated: number;
  active: number;
  consented: number;
  /** Consented registrants whose matches/seats changed since their last email (or never sent). */
  pending: number;
  upToDate: number;
  noConsent: number;
  emails: { sent: number; failed: number };
  reminders: { sent: number; failed: number };
  daysUntilEvent: number;
  /** « Inviter les participants passés » (S5-03). */
  invitations: InvitationOverview;
  /** Post-event survey « Avez-vous conclu une affaire? » (P2-S3, D-38). */
  survey: SurveySummary;
};

type Actor = { actorType: "organizer" | "system"; actorId?: string | null };

type Target = {
  registrationId: string;
  participantId: string;
  fingerprint: string;
  publishedMatchesHash: string | null;
};

async function loadEvent(eventId: string, organizationId: string) {
  const event = await prisma.event.findFirst({
    where: { id: eventId, organizationId },
    include: { organization: true },
  });
  if (!event) throw new NotFoundError("Cet événement est introuvable.");
  return event;
}

/** Active, non-deleted registrants with the fingerprint of what they would receive today. */
async function listTargets(eventId: string): Promise<Target[]> {
  const [registrations, matches, seats] = await Promise.all([
    prisma.eventRegistration.findMany({
      where: { eventId, status: { not: "CANCELLED" }, participant: { deletedAt: null } },
      select: { id: true, participantId: true, publishedMatchesHash: true },
      orderBy: { id: "asc" },
    }),
    prisma.match.findMany({
      where: { eventId, status: { not: "EXCLUDED" } },
      select: { aId: true, bId: true },
    }),
    prisma.tableAssignment.findMany({
      where: { registration: { eventId } },
      select: { registrationId: true, round: true, tableId: true },
    }),
  ]);
  const active = new Set(registrations.map((r) => r.id));
  const partners = new Map<string, string[]>();
  for (const match of matches) {
    if (!active.has(match.aId) || !active.has(match.bId)) continue;
    partners.set(match.aId, [...(partners.get(match.aId) ?? []), match.bId]);
    partners.set(match.bId, [...(partners.get(match.bId) ?? []), match.aId]);
  }
  const seatsOf = new Map<string, { round: number; tableId: string }[]>();
  for (const seat of seats) {
    seatsOf.set(seat.registrationId, [
      ...(seatsOf.get(seat.registrationId) ?? []),
      { round: seat.round, tableId: seat.tableId },
    ]);
  }
  return registrations.map((r) => ({
    registrationId: r.id,
    participantId: r.participantId,
    publishedMatchesHash: r.publishedMatchesHash,
    fingerprint: matchesFingerprint({
      partnerRegistrationIds: partners.get(r.id) ?? [],
      seats: seatsOf.get(r.id) ?? [],
    }),
  }));
}

async function consentedSet(
  organization: Organization,
  participantIds: string[],
): Promise<Set<string>> {
  if (!participantIds.length) return new Set();
  const logs = await prisma.consentLog.findMany({
    where: {
      consentVersion: currentConsentVersion(organization),
      participantId: { in: participantIds },
    },
    select: { participantId: true },
  });
  return new Set(logs.map((l) => l.participantId));
}

export async function getPublicationOverview(
  eventId: string,
  organizationId: string,
): Promise<PublicationOverview> {
  const event = await loadEvent(eventId, organizationId);
  const [targets, totalMatches, seated, logs, invitations, survey] = await Promise.all([
    listTargets(eventId),
    prisma.match.count({ where: { eventId, status: { not: "EXCLUDED" } } }),
    prisma.tableAssignment.count({ where: { registration: { eventId }, round: 1 } }),
    prisma.emailLog.groupBy({
      by: ["template", "status"],
      where: { eventId, template: { in: ["matches_published", "reminder"] } },
      _count: { _all: true },
    }),
    getInvitationOverview(eventId, organizationId),
    eventSurveySummary(eventId, organizationId),
  ]);
  const consented = await consentedSet(
    event.organization,
    targets.map((t) => t.participantId),
  );
  let pending = 0;
  let upToDate = 0;
  let noConsent = 0;
  for (const target of targets) {
    if (!consented.has(target.participantId)) noConsent += 1;
    else if (target.publishedMatchesHash === target.fingerprint) upToDate += 1;
    else pending += 1;
  }
  const count = (template: string, status: string) =>
    logs.find((l) => l.template === template && l.status === status)?._count._all ?? 0;
  return {
    status: event.status,
    publishedAt: event.publishedAt,
    reminderSentAt: event.reminderSentAt,
    totalMatches,
    seated,
    active: targets.length,
    consented: consented.size,
    pending,
    upToDate,
    noConsent,
    emails: {
      sent: count("matches_published", "sent"),
      failed: count("matches_published", "failed"),
    },
    reminders: { sent: count("reminder", "sent"), failed: count("reminder", "failed") },
    daysUntilEvent: Math.ceil((event.startsAt.getTime() - Date.now()) / 86_400_000),
    invitations,
    survey,
  };
}

/** « Publier les jumelages » : the event becomes PUBLISHED; emails follow in batches. */
export async function startPublication(
  eventId: string,
  organizationId: string,
  actor: Actor,
): Promise<void> {
  const event = await loadEvent(eventId, organizationId);
  const matches = await prisma.match.count({ where: { eventId, status: { not: "EXCLUDED" } } });
  if (matches === 0) throw new AppError("Lancez d'abord le matching : aucun jumelage à publier.");
  if (event.status === "COMPLETED" || event.status === "ARCHIVED") {
    throw new AppError("Cet événement est terminé.");
  }
  await prisma.event.update({
    where: { id: eventId },
    data: { status: "PUBLISHED", publishedAt: new Date() },
  });
  await audit({
    organizationId,
    actorType: actor.actorType,
    actorId: actor.actorId ?? null,
    action: "PUBLISH",
    entity: "Event",
    entityId: eventId,
    metadata: { from: event.status, matches },
  });
}

/** « Envoyer un rappel » : marks the start of a reminder run; emails follow in batches. */
export async function startReminder(
  eventId: string,
  organizationId: string,
  actor: Actor,
): Promise<void> {
  const event = await loadEvent(eventId, organizationId);
  if (!event.publishedAt) throw new AppError("Publiez d'abord les jumelages.");
  await prisma.event.update({ where: { id: eventId }, data: { reminderSentAt: new Date() } });
  await audit({
    organizationId,
    actorType: actor.actorType,
    actorId: actor.actorId ?? null,
    action: "UPDATE",
    entity: "Event",
    entityId: eventId,
    metadata: { reminder: "started" },
  });
}

async function withRetry(send: () => Promise<boolean>): Promise<boolean> {
  if (await send()) return true;
  await new Promise((resolve) => setTimeout(resolve, 400));
  return send();
}

async function seatsFor(
  event: Event & { organization: Organization },
  registrationId: string,
): Promise<PublishedSeat[]> {
  const assignments = await prisma.tableAssignment.findMany({
    where: { registrationId, round: { lte: event.roundCount } },
    include: { table: true },
    orderBy: { round: "asc" },
  });
  return assignments.map((a) => ({
    round: a.round,
    time: formatDate(roundStartsAt(event, a.round), event.organization.timezone, "time"),
    table: tableName(a.table),
  }));
}

async function matchesFor(eventId: string, registrationId: string): Promise<PublishedMatch[]> {
  const matches = await prisma.match.findMany({
    where: {
      eventId,
      status: { not: "EXCLUDED" },
      OR: [{ aId: registrationId }, { bId: registrationId }],
    },
    include: {
      a: { include: { participant: { include: { sector: true } } } },
      b: { include: { participant: { include: { sector: true } } } },
    },
    orderBy: { score: "desc" },
  });
  return matches
    .map((match) => {
      const isA = match.aId === registrationId;
      const other = isA ? match.b : match.a;
      if (other.status === "CANCELLED") return null;
      return {
        name: `${other.participant.firstName} ${other.participant.lastName}`,
        company: other.participant.companyName,
        sector: other.participant.sector?.name ?? null,
        sentences: describeMatch(match.reasons as unknown as MatchReasons, isA ? "a" : "b"),
      };
    })
    .filter((m): m is PublishedMatch => m !== null);
}

/**
 * Sends the next batch of one kind of email. Called repeatedly by the Publication tab until
 * `remaining` is 0, so a large event never runs into a serverless time limit (D-28).
 */
export async function runEmailBatch(
  eventId: string,
  organizationId: string,
  kind: EmailBatchKind,
  size = EMAIL_BATCH_SIZE,
): Promise<BatchProgress> {
  // Invitations go to people who are NOT registered: a different queue, same batch mechanics.
  if (kind === "invite") return runInvitationBatch(eventId, organizationId, size);
  if (kind === "survey") return runSurveyBatch(eventId, organizationId, size);
  const event = await loadEvent(eventId, organizationId);
  const organization = event.organization;
  const targets = await listTargets(eventId);
  const consented = await consentedSet(
    organization,
    targets.map((t) => t.participantId),
  );

  let queue: Target[];
  if (kind === "publish") {
    if (!event.publishedAt) throw new AppError("Publiez d'abord les jumelages.");
    queue = targets.filter(
      (t) => consented.has(t.participantId) && t.publishedMatchesHash !== t.fingerprint,
    );
  } else if (kind === "reminder") {
    if (!event.reminderSentAt) throw new AppError("Lancez d'abord l'envoi du rappel.");
    const reminded = await prisma.emailLog.findMany({
      where: {
        eventId,
        template: "reminder",
        status: "sent",
        createdAt: { gte: event.reminderSentAt },
      },
      select: { toEmail: true },
    });
    const remindedEmails = new Set(reminded.map((r) => r.toEmail));
    const emails = await prisma.participant.findMany({
      where: { id: { in: targets.map((t) => t.participantId) } },
      select: { id: true, email: true },
    });
    const emailOf = new Map(emails.map((e) => [e.id, e.email]));
    queue = targets.filter(
      (t) =>
        consented.has(t.participantId) && !remindedEmails.has(emailOf.get(t.participantId) ?? ""),
    );
  } else {
    // Consent requests: everyone without the current consent, at most once per 24 h.
    const recent = await prisma.emailLog.findMany({
      where: {
        eventId,
        template: "consent_pending",
        status: "sent",
        createdAt: { gte: new Date(Date.now() - 86_400_000) },
      },
      select: { toEmail: true },
    });
    const recentEmails = new Set(recent.map((r) => r.toEmail));
    const emails = await prisma.participant.findMany({
      where: { id: { in: targets.map((t) => t.participantId) } },
      select: { id: true, email: true },
    });
    const emailOf = new Map(emails.map((e) => [e.id, e.email]));
    queue = targets.filter(
      (t) =>
        !consented.has(t.participantId) && !recentEmails.has(emailOf.get(t.participantId) ?? ""),
    );
  }

  const total = queue.length;
  const batch = queue.slice(0, size);
  let sent = 0;
  let failed = 0;
  for (const target of batch) {
    const participant = await prisma.participant.findUnique({
      where: { id: target.participantId },
    });
    if (!participant) continue;
    try {
      let ok: boolean;
      if (kind === "publish") {
        const [matches, seats] = await Promise.all([
          matchesFor(eventId, target.registrationId),
          seatsFor(event, target.registrationId),
        ]);
        ok = await withRetry(() =>
          sendMatchesPublished({
            organization,
            event,
            participant,
            matches,
            seats,
            isUpdate: target.publishedMatchesHash !== null,
          }),
        );
        if (ok) {
          await prisma.eventRegistration.update({
            where: { id: target.registrationId },
            data: { publishedMatchesHash: target.fingerprint, publishedAt: new Date() },
          });
        }
      } else if (kind === "reminder") {
        const [seats, matchCount] = await Promise.all([
          seatsFor(event, target.registrationId),
          prisma.match.count({
            where: {
              eventId,
              status: { not: "EXCLUDED" },
              OR: [{ aId: target.registrationId }, { bId: target.registrationId }],
            },
          }),
        ]);
        ok = await withRetry(() =>
          sendReminder({ organization, event, participant, seats, matchCount }),
        );
      } else {
        ok = await withRetry(() => sendConsentPending({ organization, event, participant }));
      }
      if (ok) sent += 1;
      else failed += 1;
    } catch (error) {
      logger.error(
        { err: error, kind, registrationId: target.registrationId },
        "batch email failed",
      );
      failed += 1;
    }
  }
  // Failed ones stay in the queue for a later retry only when the organizer clicks again; report
  // them as done for this run so the loop cannot spin forever on a broken transport.
  const remaining = Math.max(0, total - batch.length);
  return { sent, failed, remaining, total };
}
