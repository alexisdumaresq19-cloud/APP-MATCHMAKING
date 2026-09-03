import type { Event, FeedbackOutcome } from "@prisma/client";
import { audit } from "@/lib/audit";
import { participantAccessUrl } from "@/lib/auth/participant-session";
import { prisma } from "@/lib/db/prisma";
import { emailBrandOf } from "@/lib/email/brand";
import { sendEmail } from "@/lib/email/send";
import { EventSurveyEmail } from "@/lib/email/templates/event-survey";
import { AppError, NotFoundError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { currentConsentVersion } from "./consent";
import type { BatchProgress } from "./publication";

/**
 * Post-event survey « Avez-vous conclu une affaire? » (P2-S3, D-38): one answer per match and
 * rater, editable, private to the organization's statistics; feeds the affinity suggestions.
 */
export const SURVEY_TEMPLATE = "event_survey";

export { OUTCOMES, OUTCOME_LABELS, type FeedbackMatchRow } from "@/lib/feedback";
import type { FeedbackMatchRow } from "@/lib/feedback";

type Actor = { actorType: "organizer" | "system"; actorId?: string | null };

/** The rater's matches for a completed event, with the answers already given. */
export async function listMatchesForFeedback(
  participantId: string,
  eventId: string,
): Promise<{ event: Event; rows: FeedbackMatchRow[] } | null> {
  const registration = await prisma.eventRegistration.findFirst({
    where: { participantId, eventId, status: { not: "CANCELLED" }, event: { status: "COMPLETED" } },
    include: {
      event: true,
      matchesAsA: {
        where: { status: { not: "EXCLUDED" } },
        include: { b: { include: { participant: true } }, feedbacks: { where: { participantId } } },
      },
      matchesAsB: {
        where: { status: { not: "EXCLUDED" } },
        include: { a: { include: { participant: true } }, feedbacks: { where: { participantId } } },
      },
    },
  });
  if (!registration) return null;
  const rows: FeedbackMatchRow[] = [
    ...registration.matchesAsA.map((m) => ({ match: m, partner: m.b.participant })),
    ...registration.matchesAsB.map((m) => ({ match: m, partner: m.a.participant })),
  ]
    .filter(({ partner }) => !partner.deletedAt)
    .map(({ match, partner }) => ({
      matchId: match.id,
      partnerName: `${partner.firstName} ${partner.lastName}`,
      partnerCompany: partner.companyName,
      outcome: match.feedbacks[0]?.outcome ?? null,
      comment: match.feedbacks[0]?.comment ?? null,
    }))
    .sort((x, y) => x.partnerCompany.localeCompare(y.partnerCompany, "fr"));
  return { event: registration.event, rows };
}

export async function saveEventFeedback(
  organizationId: string,
  participantId: string,
  eventId: string,
  entries: { matchId: string; outcome: FeedbackOutcome; comment: string | null }[],
): Promise<number> {
  const own = await listMatchesForFeedback(participantId, eventId);
  if (!own) throw new AppError("Le bilan n'est disponible qu'après un événement terminé.");
  const allowed = new Set(own.rows.map((r) => r.matchId));
  const valid = entries.filter((e) => allowed.has(e.matchId));
  for (const entry of valid) {
    await prisma.matchFeedback.upsert({
      where: { matchId_participantId: { matchId: entry.matchId, participantId } },
      create: {
        matchId: entry.matchId,
        participantId,
        outcome: entry.outcome,
        comment: entry.comment,
      },
      update: { outcome: entry.outcome, comment: entry.comment },
    });
  }
  if (valid.length) {
    await audit({
      organizationId,
      actorType: "participant",
      actorId: participantId,
      action: "CREATE",
      entity: "MatchFeedback",
      entityId: eventId,
      metadata: { answers: valid.length },
    });
  }
  return valid.length;
}

export type SurveySummary = {
  eligible: number;
  sent: number;
  responses: number;
  rated: number;
  byOutcome: Record<FeedbackOutcome, number>;
  comments: { company: string; partner: string; outcome: FeedbackOutcome; comment: string }[];
  startedAt: Date | null;
};

/** People who attended (checked in), consented, have matches and were not surveyed yet. */
async function surveyTargets(eventId: string, organizationId: string) {
  const [event, registrations, surveyed] = await Promise.all([
    prisma.event.findFirst({
      where: { id: eventId, organizationId },
      include: { organization: true },
    }),
    prisma.eventRegistration.findMany({
      where: { eventId, status: "CHECKED_IN", participant: { deletedAt: null } },
      include: {
        participant: true,
        _count: {
          select: {
            matchesAsA: { where: { status: { not: "EXCLUDED" } } },
            matchesAsB: { where: { status: { not: "EXCLUDED" } } },
          },
        },
      },
      orderBy: { id: "asc" },
    }),
    prisma.emailLog.findMany({
      where: { eventId, template: SURVEY_TEMPLATE, status: "sent" },
      select: { toEmail: true },
    }),
  ]);
  if (!event) throw new NotFoundError("Cet événement est introuvable.");
  const version = currentConsentVersion(event.organization);
  const consented = new Set(
    (
      await prisma.consentLog.findMany({
        where: {
          consentVersion: version,
          participantId: { in: registrations.map((r) => r.participantId) },
        },
        select: { participantId: true },
      })
    ).map((c) => c.participantId),
  );
  const surveyedEmails = new Set(surveyed.map((s) => s.toEmail));
  const eligible = registrations.filter(
    (r) => consented.has(r.participantId) && r._count.matchesAsA + r._count.matchesAsB > 0,
  );
  return {
    event,
    eligible,
    pending: eligible.filter((r) => !surveyedEmails.has(r.participant.email)),
    sent: surveyed.length,
  };
}

export async function eventSurveySummary(
  eventId: string,
  organizationId: string,
): Promise<SurveySummary> {
  const [targets, feedbacks] = await Promise.all([
    surveyTargets(eventId, organizationId),
    prisma.matchFeedback.findMany({
      where: { match: { eventId } },
      include: {
        participant: { select: { companyName: true } },
        match: {
          include: {
            a: { include: { participant: { select: { id: true, companyName: true } } } },
            b: { include: { participant: { select: { id: true, companyName: true } } } },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    }),
  ]);
  const byOutcome: Record<FeedbackOutcome, number> = {
    DEAL: 0,
    FOLLOW_UP: 0,
    NO_FIT: 0,
    NOT_MET: 0,
  };
  for (const feedback of feedbacks) byOutcome[feedback.outcome] += 1;
  return {
    eligible: targets.eligible.length,
    sent: targets.sent,
    responses: new Set(feedbacks.map((f) => f.participantId)).size,
    rated: feedbacks.length,
    byOutcome,
    comments: feedbacks
      .filter((f) => f.comment)
      .slice(0, 20)
      .map((f) => {
        const partner =
          f.match.a.participant.id === f.participantId
            ? f.match.b.participant
            : f.match.a.participant;
        return {
          company: f.participant.companyName,
          partner: partner.companyName,
          outcome: f.outcome,
          comment: f.comment ?? "",
        };
      }),
    startedAt: targets.event.surveySentAt,
  };
}

export async function startSurvey(
  eventId: string,
  organizationId: string,
  actor: Actor,
): Promise<void> {
  const event = await prisma.event.findFirst({ where: { id: eventId, organizationId } });
  if (!event) throw new NotFoundError("Cet événement est introuvable.");
  if (event.status !== "COMPLETED") throw new AppError("Terminez d'abord l'événement.");
  if (!event.publishedAt) throw new AppError("Aucun jumelage n'a été publié pour cet événement.");
  await prisma.event.update({ where: { id: eventId }, data: { surveySentAt: new Date() } });
  await audit({
    organizationId,
    actorType: actor.actorType,
    actorId: actor.actorId ?? null,
    action: "UPDATE",
    entity: "Event",
    entityId: eventId,
    metadata: { survey: "started" },
  });
}

async function withRetry(send: () => Promise<boolean>): Promise<boolean> {
  if (await send()) return true;
  await new Promise((resolve) => setTimeout(resolve, 400));
  return send();
}

export async function runSurveyBatch(
  eventId: string,
  organizationId: string,
  size: number,
): Promise<BatchProgress> {
  const targets = await surveyTargets(eventId, organizationId);
  const { event } = targets;
  if (!event.surveySentAt) throw new AppError("Lancez d'abord l'envoi du bilan.");
  const batch = targets.pending.slice(0, size);
  let sent = 0;
  let failed = 0;
  for (const registration of batch) {
    const participant = registration.participant;
    try {
      const ok = await withRetry(async () =>
        sendEmail({
          organization: event.organization,
          to: participant.email,
          subject: `Comment se sont passées vos rencontres à ${event.name}?`,
          template: SURVEY_TEMPLATE,
          eventId,
          react: EventSurveyEmail({
            brand: emailBrandOf(event.organization),
            firstName: participant.firstName,
            eventName: event.name,
            surveyUrl: `${await participantAccessUrl(participant)}/evenements/${eventId}/bilan`,
          }),
        }),
      );
      if (ok) sent += 1;
      else failed += 1;
    } catch (error) {
      logger.error({ err: error, registrationId: registration.id }, "survey email failed");
      failed += 1;
    }
  }
  return {
    sent,
    failed,
    remaining: Math.max(0, targets.pending.length - batch.length),
    total: targets.pending.length,
  };
}
