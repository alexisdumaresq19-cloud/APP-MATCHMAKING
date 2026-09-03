import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors";
import {
  addContact,
  contactsCsv,
  listContacts,
  removeContact,
  updateContactNote,
} from "@/server/services/contacts";
import {
  getThread,
  listConversations,
  messagingAllowed,
  sendMessage,
  setConversationBlocked,
  unreadMessagesCount,
} from "@/server/services/messaging";

/** D-37: who can write to whom, notifications, blocking, and the private address book. */
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
let organizationId: string;
let eventId: string;
const ids: Record<string, string> = {};

beforeAll(async () => {
  const organization = await prisma.organization.create({
    data: {
      slug: `msg-${suffix}`,
      name: "Org messagerie",
      consentText: "Texte de consentement de test, assez long pour la validation du formulaire.",
      consentVersion: `v-${suffix}`,
      privacyEmail: `privacy-${suffix}@test.local`,
      replyToEmail: `reply-${suffix}@test.local`,
      events: {
        create: {
          slug: `ev-${suffix}`,
          name: "Rencontre passée",
          startsAt: new Date(Date.now() - 7 * 86_400_000),
          status: "COMPLETED",
          publishedAt: new Date(Date.now() - 8 * 86_400_000),
        },
      },
    },
    include: { events: true },
  });
  organizationId = organization.id;
  eventId = organization.events[0].id;
  const person = async (key: string, extra: object = {}) => {
    const row = await prisma.participant.create({
      data: {
        organizationId,
        email: `${key}-${suffix}@test.local`,
        firstName: key.toUpperCase(),
        lastName: "Test",
        companyName: `Entreprise ${key.toUpperCase()}`,
        offers: ["x"],
        needs: ["y"],
        ...extra,
      },
    });
    ids[key] = row.id;
    return row;
  };
  await person("a");
  await person("b");
  await person("c", { directoryOptIn: true, directoryOptInAt: new Date() });
  await person("d", { directoryOptIn: true, directoryOptInAt: new Date() });
  await person("e");
  // A and B were matched together at the past event.
  const [ra, rb] = await Promise.all(
    [ids.a, ids.b].map((participantId) =>
      prisma.eventRegistration.create({
        data: {
          eventId,
          participantId,
          status: "CHECKED_IN",
          offersSnapshot: [],
          needsSnapshot: [],
        },
      }),
    ),
  );
  const [first, second] = ra.id < rb.id ? [ra, rb] : [rb, ra];
  await prisma.match.create({
    data: { eventId, aId: first.id, bId: second.id, score: 80, status: "PROPOSED", reasons: {} },
  });
});

afterAll(async () => {
  await prisma.organization.deleteMany({ where: { id: organizationId } });
  await prisma.$disconnect();
});

describe("who can write to whom", () => {
  it("allows matched pairs and listed pairs, refuses everyone else", async () => {
    expect(await messagingAllowed(organizationId, ids.a, ids.b)).toEqual({ ok: true });
    expect(await messagingAllowed(organizationId, ids.c, ids.d)).toEqual({ ok: true });
    expect(await messagingAllowed(organizationId, ids.a, ids.c)).toEqual({
      ok: false,
      reason: "not_introduced",
    });
    expect(await messagingAllowed(organizationId, ids.c, ids.e)).toEqual({
      ok: false,
      reason: "not_introduced",
    });
    expect(await messagingAllowed(organizationId, ids.a, ids.a)).toEqual({
      ok: false,
      reason: "self",
    });
    expect(await messagingAllowed(organizationId, ids.a, "nope")).toEqual({
      ok: false,
      reason: "unknown",
    });
  });
});

describe("conversation", () => {
  it("delivers, notifies once per hour, counts unread and marks as read", async () => {
    const organization = await prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
    });
    const sent = await sendMessage(organization, ids.a, ids.b, "Bonjour, on se revoit?");
    await sendMessage(organization, ids.a, ids.b, "Deuxième message.");
    expect(await unreadMessagesCount(ids.b)).toBe(2);
    expect(await unreadMessagesCount(ids.a)).toBe(0);
    const notifications = await prisma.emailLog.count({
      where: { toEmail: `b-${suffix}@test.local`, template: "message_received" },
    });
    expect(notifications).toBe(1); // throttled: one email per hour per thread

    const rows = await listConversations(ids.a);
    expect(rows).toHaveLength(1);
    expect(rows[0].other.companyName).toBe("Entreprise B");
    expect(rows[0].lastMessage?.mine).toBe(true);

    const thread = await getThread(ids.b, sent.conversationId);
    expect(thread?.messages.map((m) => m.body)).toEqual([
      "Bonjour, on se revoit?",
      "Deuxième message.",
    ]);
    expect(thread?.messages[0].mine).toBe(false);
    expect(await unreadMessagesCount(ids.b)).toBe(0);
    expect(await getThread(ids.c, sent.conversationId)).toBeNull(); // not a party
  });

  it("refuses a message between strangers", async () => {
    const organization = await prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
    });
    await expect(sendMessage(organization, ids.a, ids.c, "Salut")).rejects.toBeInstanceOf(AppError);
  });

  it("lets either side close the thread, and only that side reopen it", async () => {
    const organization = await prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
    });
    const [conversation] = await listConversations(ids.b);
    await setConversationBlocked(organizationId, ids.b, conversation.id, true);
    await expect(sendMessage(organization, ids.a, ids.b, "Encore moi")).rejects.toThrow(/fermée/);
    await expect(
      setConversationBlocked(organizationId, ids.a, conversation.id, false),
    ).rejects.toThrow(/Seule la personne/);
    await setConversationBlocked(organizationId, ids.b, conversation.id, false);
    await expect(sendMessage(organization, ids.a, ids.b, "Merci!")).resolves.toBeTruthy();
  });
});

describe("address book", () => {
  it("bookmarks introduced companies only, keeps a note, exports without coordinates", async () => {
    await addContact(organizationId, ids.a, ids.b, eventId);
    await addContact(organizationId, ids.a, ids.b, eventId); // idempotent
    await expect(addContact(organizationId, ids.a, ids.c)).rejects.toBeInstanceOf(AppError);
    await updateContactNote(ids.a, ids.b, "Rappeler en octobre");
    const contacts = await listContacts(ids.a);
    expect(contacts).toHaveLength(1);
    expect(contacts[0].companyName).toBe("Entreprise B");
    expect(contacts[0].eventName).toBe("Rencontre passée");
    expect(contacts[0].note).toBe("Rappeler en octobre");
    const csv = contactsCsv(contacts);
    expect(csv).toContain("Entreprise B");
    expect(csv).toContain("Rappeler en octobre");
    expect(csv).not.toContain("@test.local");
    await removeContact(ids.a, ids.b);
    expect(await listContacts(ids.a)).toHaveLength(0);
    await expect(updateContactNote(ids.a, ids.b, "x")).rejects.toThrow(/plus dans votre carnet/);
  });
});
