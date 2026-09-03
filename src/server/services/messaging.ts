import type { Conversation, Organization } from "@prisma/client";
import { audit } from "@/lib/audit";
import { participantAccessUrl } from "@/lib/auth/participant-session";
import { prisma } from "@/lib/db/prisma";
import { emailBrandOf } from "@/lib/email/brand";
import { sendEmail } from "@/lib/email/send";
import { MessageReceivedEmail } from "@/lib/email/templates/message-received";
import { AppError, NotFoundError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { rateLimit } from "@/lib/rate-limit";

/**
 * Private messaging between two companies of the same organization (Phase 2, D-37).
 * Who can write to whom: companies that were matched together at an event, or companies that
 * both chose to be listed in the public directory. Either side can close the thread.
 */
export const MESSAGES_PER_HOUR = 30;
const NOTIFY_EVERY_MS = 60 * 60 * 1000;

export type MessagingCheck =
  { ok: true } | { ok: false; reason: "self" | "unknown" | "not_introduced" | "blocked" };

export type ConversationRow = {
  id: string;
  other: { participantId: string; companyName: string; sector: string | null; firstName: string };
  lastMessage: { body: string; createdAt: Date; mine: boolean } | null;
  unread: number;
  blocked: boolean;
  blockedByMe: boolean;
};

export type ThreadMessage = { id: string; body: string; createdAt: Date; mine: boolean };

function orderedPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

async function wereMatched(aId: string, bId: string): Promise<boolean> {
  const match = await prisma.match.findFirst({
    where: {
      status: { not: "EXCLUDED" },
      OR: [
        { a: { participantId: aId }, b: { participantId: bId } },
        { a: { participantId: bId }, b: { participantId: aId } },
      ],
    },
    select: { id: true },
  });
  return Boolean(match);
}

/** The introduction rule, plus the block state of an existing thread. */
export async function messagingAllowed(
  organizationId: string,
  viewerId: string,
  otherId: string,
): Promise<MessagingCheck> {
  if (viewerId === otherId) return { ok: false, reason: "self" };
  const [viewer, other] = await Promise.all([
    prisma.participant.findFirst({
      where: { id: viewerId, organizationId, deletedAt: null },
      select: { directoryOptIn: true },
    }),
    prisma.participant.findFirst({
      where: { id: otherId, organizationId, deletedAt: null },
      select: { directoryOptIn: true },
    }),
  ]);
  if (!viewer || !other) return { ok: false, reason: "unknown" };
  const [aId, bId] = orderedPair(viewerId, otherId);
  const existing = await prisma.conversation.findUnique({
    where: { participantAId_participantBId: { participantAId: aId, participantBId: bId } },
    select: { blockedById: true },
  });
  if (existing?.blockedById) return { ok: false, reason: "blocked" };
  if (existing) return { ok: true };
  if (viewer.directoryOptIn && other.directoryOptIn) return { ok: true };
  if (await wereMatched(viewerId, otherId)) return { ok: true };
  return { ok: false, reason: "not_introduced" };
}

export function messagingRefusal(reason: Exclude<MessagingCheck, { ok: true }>["reason"]): string {
  switch (reason) {
    case "self":
      return "Vous ne pouvez pas vous écrire à vous-même.";
    case "blocked":
      return "Cette conversation est fermée.";
    case "unknown":
      return "Cette entreprise est introuvable.";
    default:
      return "Vous pouvez écrire aux entreprises avec lesquelles vous avez été jumelé, ou à celles de l'annuaire public si votre entreprise y figure aussi.";
  }
}

export async function getOrCreateConversation(
  organizationId: string,
  viewerId: string,
  otherId: string,
): Promise<Conversation> {
  const check = await messagingAllowed(organizationId, viewerId, otherId);
  if (!check.ok && check.reason !== "blocked") throw new AppError(messagingRefusal(check.reason));
  const [aId, bId] = orderedPair(viewerId, otherId);
  return prisma.conversation.upsert({
    where: { participantAId_participantBId: { participantAId: aId, participantBId: bId } },
    create: { organizationId, participantAId: aId, participantBId: bId },
    update: {},
  });
}

export async function unreadMessagesCount(participantId: string): Promise<number> {
  return prisma.message.count({
    where: {
      readAt: null,
      senderId: { not: participantId },
      conversation: { OR: [{ participantAId: participantId }, { participantBId: participantId }] },
    },
  });
}

/** Sends one message; the recipient gets at most one email notification per hour per thread. */
export async function sendMessage(
  organization: Organization,
  senderId: string,
  recipientId: string,
  body: string,
): Promise<{ conversationId: string; messageId: string }> {
  const check = await messagingAllowed(organization.id, senderId, recipientId);
  if (!check.ok) throw new AppError(messagingRefusal(check.reason));
  const limit = await rateLimit(`message:${senderId}`, {
    limit: MESSAGES_PER_HOUR,
    windowSeconds: 3600,
  });
  if (!limit.ok)
    throw new AppError("Vous avez envoyé beaucoup de messages. Réessayez dans une heure.");

  const conversation = await getOrCreateConversation(organization.id, senderId, recipientId);
  const message = await prisma.message.create({
    data: { conversationId: conversation.id, senderId, body },
  });
  const recipientIsA = conversation.participantAId === recipientId;
  const lastNotified = recipientIsA ? conversation.notifiedAAt : conversation.notifiedBAt;
  const shouldNotify = !lastNotified || Date.now() - lastNotified.getTime() > NOTIFY_EVERY_MS;
  await prisma.conversation.update({
    where: { id: conversation.id },
    data: {
      lastMessageAt: message.createdAt,
      ...(shouldNotify
        ? recipientIsA
          ? { notifiedAAt: new Date() }
          : { notifiedBAt: new Date() }
        : {}),
    },
  });
  if (shouldNotify) {
    try {
      const [recipient, sender] = await Promise.all([
        prisma.participant.findUniqueOrThrow({ where: { id: recipientId } }),
        prisma.participant.findUniqueOrThrow({ where: { id: senderId } }),
      ]);
      await sendEmail({
        organization,
        to: recipient.email,
        subject: `Nouveau message de ${sender.companyName}`,
        template: "message_received",
        react: MessageReceivedEmail({
          brand: emailBrandOf(organization),
          firstName: recipient.firstName,
          fromCompany: sender.companyName,
          preview: body.length > 200 ? `${body.slice(0, 200)}…` : body,
          threadUrl: `${await participantAccessUrl(recipient)}/messages/${conversation.id}`,
        }),
      });
    } catch (error) {
      logger.error({ err: error, conversationId: conversation.id }, "message notification failed");
    }
  }
  return { conversationId: conversation.id, messageId: message.id };
}

const conversationInclude = {
  participantA: {
    select: { id: true, companyName: true, firstName: true, sector: { select: { name: true } } },
  },
  participantB: {
    select: { id: true, companyName: true, firstName: true, sector: { select: { name: true } } },
  },
  messages: { orderBy: { createdAt: "desc" as const }, take: 1 },
};

type ConversationSource = Awaited<
  ReturnType<typeof prisma.conversation.findFirst<{ include: typeof conversationInclude }>>
>;

function toRow(
  conversation: NonNullable<ConversationSource>,
  viewerId: string,
  unread: number,
): ConversationRow {
  const other =
    conversation.participantAId === viewerId
      ? conversation.participantB
      : conversation.participantA;
  const last = conversation.messages[0];
  return {
    id: conversation.id,
    other: {
      participantId: other.id,
      companyName: other.companyName,
      sector: other.sector?.name ?? null,
      firstName: other.firstName,
    },
    lastMessage: last
      ? { body: last.body, createdAt: last.createdAt, mine: last.senderId === viewerId }
      : null,
    unread,
    blocked: conversation.blockedById !== null,
    blockedByMe: conversation.blockedById === viewerId,
  };
}

export async function listConversations(participantId: string): Promise<ConversationRow[]> {
  const conversations = await prisma.conversation.findMany({
    where: { OR: [{ participantAId: participantId }, { participantBId: participantId }] },
    include: conversationInclude,
    orderBy: [{ lastMessageAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
    take: 200,
  });
  if (conversations.length === 0) return [];
  const unread = await prisma.message.groupBy({
    by: ["conversationId"],
    where: {
      conversationId: { in: conversations.map((c) => c.id) },
      readAt: null,
      senderId: { not: participantId },
    },
    _count: { _all: true },
  });
  const unreadOf = new Map(unread.map((u) => [u.conversationId, u._count._all]));
  return conversations.map((c) => toRow(c, participantId, unreadOf.get(c.id) ?? 0));
}

/** One thread, oldest message first; the other side's unread messages are marked as read. */
export async function getThread(
  participantId: string,
  conversationId: string,
): Promise<{ conversation: ConversationRow; messages: ThreadMessage[] } | null> {
  const conversation = await prisma.conversation.findFirst({
    where: {
      id: conversationId,
      OR: [{ participantAId: participantId }, { participantBId: participantId }],
    },
    include: conversationInclude,
  });
  if (!conversation) return null;
  await prisma.message.updateMany({
    where: { conversationId, senderId: { not: participantId }, readAt: null },
    data: { readAt: new Date() },
  });
  const messages = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
    take: 500,
  });
  return {
    conversation: toRow(conversation, participantId, 0),
    messages: messages.map((m) => ({
      id: m.id,
      body: m.body,
      createdAt: m.createdAt,
      mine: m.senderId === participantId,
    })),
  };
}

/** « Fermer la conversation » / « Rouvrir » : only the person who closed it can reopen it. */
export async function setConversationBlocked(
  organizationId: string,
  participantId: string,
  conversationId: string,
  blocked: boolean,
): Promise<void> {
  const conversation = await prisma.conversation.findFirst({
    where: {
      id: conversationId,
      organizationId,
      OR: [{ participantAId: participantId }, { participantBId: participantId }],
    },
  });
  if (!conversation) throw new NotFoundError("Cette conversation est introuvable.");
  if (!blocked && conversation.blockedById && conversation.blockedById !== participantId) {
    throw new AppError("Seule la personne qui a fermé la conversation peut la rouvrir.");
  }
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { blockedById: blocked ? participantId : null },
  });
  await audit({
    organizationId,
    actorType: "participant",
    actorId: participantId,
    action: "UPDATE",
    entity: "Conversation",
    entityId: conversationId,
    metadata: { blocked },
  });
}
