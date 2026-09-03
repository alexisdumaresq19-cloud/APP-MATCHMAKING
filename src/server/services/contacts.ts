import { audit } from "@/lib/audit";
import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors";
import { toCsv } from "@/lib/export/csv";
import { messagingAllowed, messagingRefusal } from "./messaging";

/** « Ajouter à mes contacts » (Phase 2, D-37): a private bookmark, never shown to the other side. */
export type ContactRow = {
  id: string;
  participantId: string;
  companyName: string;
  sector: string | null;
  city: string | null;
  region: string | null;
  website: string | null;
  firstName: string;
  listedPublicly: boolean;
  eventName: string | null;
  note: string | null;
  createdAt: Date;
};

export async function contactIdsOf(ownerId: string): Promise<Set<string>> {
  const rows = await prisma.contact.findMany({ where: { ownerId }, select: { contactId: true } });
  return new Set(rows.map((r) => r.contactId));
}

export async function listContacts(ownerId: string): Promise<ContactRow[]> {
  const contacts = await prisma.contact.findMany({
    where: { ownerId, contact: { deletedAt: null } },
    include: { contact: { include: { sector: { select: { name: true } } } } },
    orderBy: { contact: { companyName: "asc" } },
  });
  const eventIds = [...new Set(contacts.map((c) => c.eventId).filter((id): id is string => !!id))];
  const events = eventIds.length
    ? await prisma.event.findMany({
        where: { id: { in: eventIds } },
        select: { id: true, name: true },
      })
    : [];
  const eventName = new Map(events.map((e) => [e.id, e.name]));
  return contacts.map((c) => ({
    id: c.id,
    participantId: c.contactId,
    companyName: c.contact.companyName,
    sector: c.contact.sector?.name ?? null,
    city: c.contact.city,
    region: c.contact.region,
    website: c.contact.website,
    firstName: c.contact.firstName,
    listedPublicly: c.contact.directoryOptIn,
    eventName: c.eventId ? (eventName.get(c.eventId) ?? null) : null,
    note: c.note,
    createdAt: c.createdAt,
  }));
}

/** Only companies the owner was introduced to (matched, or both listed) can be bookmarked. */
export async function addContact(
  organizationId: string,
  ownerId: string,
  contactId: string,
  eventId: string | null = null,
): Promise<void> {
  const check = await messagingAllowed(organizationId, ownerId, contactId);
  if (!check.ok && check.reason !== "blocked") throw new AppError(messagingRefusal(check.reason));
  if (eventId) {
    const event = await prisma.event.findFirst({
      where: { id: eventId, organizationId },
      select: { id: true },
    });
    if (!event) eventId = null;
  }
  await prisma.contact.upsert({
    where: { ownerId_contactId: { ownerId, contactId } },
    create: { ownerId, contactId, eventId },
    update: {},
  });
  await audit({
    organizationId,
    actorType: "participant",
    actorId: ownerId,
    action: "CREATE",
    entity: "Contact",
    entityId: contactId,
    metadata: { eventId },
  });
}

export async function removeContact(ownerId: string, contactId: string): Promise<void> {
  await prisma.contact.deleteMany({ where: { ownerId, contactId } });
}

export async function updateContactNote(
  ownerId: string,
  contactId: string,
  note: string | null,
): Promise<void> {
  const updated = await prisma.contact.updateMany({
    where: { ownerId, contactId },
    data: { note },
  });
  if (updated.count === 0) throw new AppError("Ce contact n'est plus dans votre carnet.");
}

/** CSV of the address book: company facts and the owner's notes, never personal coordinates. */
export function contactsCsv(rows: ContactRow[]): string {
  return toCsv(
    ["Entreprise", "Secteur", "Ville", "Région", "Site web", "Rencontré à", "Note", "Ajouté le"],
    rows.map((row) => [
      row.companyName,
      row.sector ?? "",
      row.city ?? "",
      row.region ?? "",
      row.website ?? "",
      row.eventName ?? "",
      row.note ?? "",
      row.createdAt.toISOString().slice(0, 10),
    ]),
  );
}
