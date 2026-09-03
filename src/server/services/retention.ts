import { participantAccessUrl } from "@/lib/auth/participant-session";
import { formatDate } from "@/lib/dates";
import { prisma } from "@/lib/db/prisma";
import { emailBrandOf } from "@/lib/email/brand";
import { sendEmail } from "@/lib/email/send";
import { RetentionNoticeEmail } from "@/lib/email/templates/retention-notice";
import { logger } from "@/lib/logger";
import { anonymizeParticipant } from "./privacy";

/**
 * Automatic retention (P2-S3, D-39): a profile with no event, no edit and no message for 24
 * months gets a notice; 30 days later, still inactive, it is anonymized like a deletion request.
 */
export const INACTIVITY_MONTHS = 24;
export const NOTICE_DAYS = 30;

export type RetentionRun = { organizations: number; noticed: number; anonymized: number };

function monthsAgo(now: Date, months: number): Date {
  const date = new Date(now);
  date.setMonth(date.getMonth() - months);
  return date;
}

function inactiveWhere(organizationId: string, cutoff: Date) {
  return {
    organizationId,
    deletedAt: null,
    createdAt: { lt: cutoff },
    updatedAt: { lt: cutoff },
    registrations: { none: { event: { startsAt: { gte: cutoff } } } },
    messagesSent: { none: { createdAt: { gte: cutoff } } },
  };
}

export async function runRetention(now = new Date()): Promise<RetentionRun> {
  const cutoff = monthsAgo(now, INACTIVITY_MONTHS);
  const noticeDeadline = new Date(now.getTime() - NOTICE_DAYS * 86_400_000);
  const organizations = await prisma.organization.findMany();
  const run: RetentionRun = { organizations: organizations.length, noticed: 0, anonymized: 0 };

  for (const organization of organizations) {
    // 1. Notice: inactive people who were not warned yet.
    const toNotice = await prisma.participant.findMany({
      where: { ...inactiveWhere(organization.id, cutoff), purgeNoticeSentAt: null },
      take: 200,
    });
    for (const participant of toNotice) {
      try {
        const deleteAfter = new Date(now.getTime() + NOTICE_DAYS * 86_400_000);
        const sent = await sendEmail({
          organization,
          to: participant.email,
          subject: "Votre profil sera supprimé dans 30 jours",
          template: "retention_notice",
          react: RetentionNoticeEmail({
            brand: emailBrandOf(organization),
            firstName: participant.firstName,
            organizationName: organization.name,
            deleteAfterLabel: formatDate(deleteAfter, organization.timezone, "date"),
            keepUrl: `${await participantAccessUrl(participant)}/conserver`,
          }),
        });
        // The notice is stamped without touching `updatedAt` semantics: Prisma bumps it, so the
        // inactivity window is re-checked from the notice date at the anonymization step.
        await prisma.participant.update({
          where: { id: participant.id },
          data: { purgeNoticeSentAt: sent ? now : null },
        });
        if (sent) run.noticed += 1;
      } catch (error) {
        logger.error({ err: error, participantId: participant.id }, "retention notice failed");
      }
    }

    // 2. Anonymize: warned more than 30 days ago and nothing happened since the notice.
    const toAnonymize = await prisma.participant.findMany({
      where: {
        organizationId: organization.id,
        deletedAt: null,
        purgeNoticeSentAt: { lt: noticeDeadline },
      },
      take: 200,
    });
    for (const participant of toAnonymize) {
      const active = await prisma.participant.findFirst({
        where: {
          id: participant.id,
          OR: [
            { registrations: { some: { createdAt: { gte: participant.purgeNoticeSentAt! } } } },
            { messagesSent: { some: { createdAt: { gte: participant.purgeNoticeSentAt! } } } },
            { consents: { some: { createdAt: { gte: participant.purgeNoticeSentAt! } } } },
          ],
        },
        select: { id: true },
      });
      if (active) {
        await prisma.participant.update({
          where: { id: participant.id },
          data: { purgeNoticeSentAt: null },
        });
        continue;
      }
      try {
        await anonymizeParticipant(organization.id, participant.id, {
          organizerId: null,
          actorType: "system",
          note: `Purge automatique : ${INACTIVITY_MONTHS} mois sans activité, préavis de ${NOTICE_DAYS} jours.`,
        });
        run.anonymized += 1;
      } catch (error) {
        logger.error({ err: error, participantId: participant.id }, "retention purge failed");
      }
    }
  }
  return run;
}

/** « Conserver mon profil » : the person came back, the countdown stops. */
export async function keepProfile(participantId: string): Promise<void> {
  await prisma.participant.update({
    where: { id: participantId },
    data: { purgeNoticeSentAt: null },
  });
}
