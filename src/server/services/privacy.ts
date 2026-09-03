import type { DeletionRequest, Organization, Participant } from "@prisma/client";
import { anonymizedParticipantData, anonymizedRegistrationData } from "@/lib/anonymize";
import { audit } from "@/lib/audit";
import { appBaseUrl } from "@/lib/auth/participant-session";
import { prisma } from "@/lib/db/prisma";
import { emailBrandOf } from "@/lib/email/brand";
import { sendEmail } from "@/lib/email/send";
import { DeletionConfirmedEmail } from "@/lib/email/templates/deletion-confirmed";
import { DeletionRequestedEmail } from "@/lib/email/templates/deletion-requested";
import { AppError, NotFoundError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { describeMatch, type MatchReasons } from "@/lib/matching";
import { formatPhone } from "@/lib/normalize";

/** Everything the platform holds about one participant, in plain words (Law 25 access right). */
export type PersonalDataBundle = {
  exportedAt: string;
  organization: { name: string; privacyEmail: string };
  profile: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    jobTitle: string | null;
    companyName: string;
    sector: string | null;
    website: string | null;
    city: string | null;
    region: string | null;
    offers: string[];
    needs: string[];
    soughtSectors: string[];
    description: string | null;
    createdAt: string;
    updatedAt: string;
  };
  registrations: {
    event: string;
    date: string;
    status: string;
    source: string;
    goalsText: string | null;
    checkedInAt: string | null;
    matches: { name: string; company: string; reasons: string[] }[];
    tables: { round: number; table: string }[];
  }[];
  consents: { acceptedAt: string; version: string; text: string }[];
  deletionRequests: { requestedAt: string; status: string; resolvedAt: string | null }[];
  /** Phase 2: the private address book and every message the person wrote or received. */
  contacts: { company: string; event: string | null; note: string | null; addedAt: string }[];
  messages: { with: string; sentAt: string; mine: boolean; body: string }[];
};

export async function buildPersonalDataBundle(participantId: string): Promise<PersonalDataBundle> {
  const participant = await prisma.participant.findUniqueOrThrow({
    where: { id: participantId },
    include: {
      organization: true,
      sector: true,
      consents: { orderBy: { createdAt: "asc" } },
      deletionRequests: { orderBy: { requestedAt: "asc" } },
      registrations: {
        include: {
          event: true,
          assignments: { include: { table: true } },
          matchesAsA: { include: { b: { include: { participant: true } } } },
          matchesAsB: { include: { a: { include: { participant: true } } } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  const [contacts, conversations] = await Promise.all([
    prisma.contact.findMany({
      where: { ownerId: participantId },
      include: { contact: { select: { companyName: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.conversation.findMany({
      where: { OR: [{ participantAId: participantId }, { participantBId: participantId }] },
      include: {
        participantA: { select: { id: true, companyName: true } },
        participantB: { select: { id: true, companyName: true } },
        messages: { orderBy: { createdAt: "asc" } },
      },
    }),
  ]);
  const contactEventIds = contacts.map((c) => c.eventId).filter((id): id is string => !!id);
  const contactEvents = contactEventIds.length
    ? await prisma.event.findMany({
        where: { id: { in: contactEventIds } },
        select: { id: true, name: true },
      })
    : [];
  const contactEventName = new Map(contactEvents.map((e) => [e.id, e.name]));
  const sectorNames = new Map(
    (
      await prisma.sector.findMany({
        where: { id: { in: participant.soughtSectorIds } },
        select: { id: true, name: true },
      })
    ).map((s) => [s.id, s.name]),
  );
  return {
    exportedAt: new Date().toISOString(),
    organization: {
      name: participant.organization.name,
      privacyEmail: participant.organization.privacyEmail,
    },
    profile: {
      firstName: participant.firstName,
      lastName: participant.lastName,
      email: participant.email,
      phone: formatPhone(participant.phone),
      jobTitle: participant.jobTitle,
      companyName: participant.companyName,
      sector: participant.sector?.name ?? null,
      website: participant.website,
      city: participant.city,
      region: participant.region,
      offers: participant.offers,
      needs: participant.needs,
      soughtSectors: participant.soughtSectorIds
        .map((id) => sectorNames.get(id))
        .filter((name): name is string => Boolean(name)),
      description: participant.description,
      createdAt: participant.createdAt.toISOString(),
      updatedAt: participant.updatedAt.toISOString(),
    },
    registrations: participant.registrations.map((registration) => ({
      event: registration.event.name,
      date: registration.event.startsAt.toISOString(),
      status: registration.status,
      source: registration.source,
      goalsText: registration.goalsText,
      checkedInAt: registration.checkedInAt?.toISOString() ?? null,
      matches: [
        ...registration.matchesAsA
          .filter((m) => m.status !== "EXCLUDED")
          .map((m) => ({
            name: `${m.b.participant.firstName} ${m.b.participant.lastName}`,
            company: m.b.participant.companyName,
            reasons: describeMatch(m.reasons as unknown as MatchReasons, "a"),
          })),
        ...registration.matchesAsB
          .filter((m) => m.status !== "EXCLUDED")
          .map((m) => ({
            name: `${m.a.participant.firstName} ${m.a.participant.lastName}`,
            company: m.a.participant.companyName,
            reasons: describeMatch(m.reasons as unknown as MatchReasons, "b"),
          })),
      ],
      tables: registration.assignments
        .sort((a, b) => a.round - b.round)
        .map((a) => ({ round: a.round, table: a.table.label ?? `Table ${a.table.number}` })),
    })),
    consents: participant.consents.map((c) => ({
      acceptedAt: c.createdAt.toISOString(),
      version: c.consentVersion,
      text: c.consentText,
    })),
    deletionRequests: participant.deletionRequests.map((d) => ({
      requestedAt: d.requestedAt.toISOString(),
      status: d.status,
      resolvedAt: d.resolvedAt?.toISOString() ?? null,
    })),
    contacts: contacts.map((c) => ({
      company: c.contact.companyName,
      event: c.eventId ? (contactEventName.get(c.eventId) ?? null) : null,
      note: c.note,
      addedAt: c.createdAt.toISOString(),
    })),
    messages: conversations.flatMap((conversation) => {
      const other =
        conversation.participantAId === participantId
          ? conversation.participantB
          : conversation.participantA;
      return conversation.messages.map((m) => ({
        with: other.companyName,
        sentAt: m.createdAt.toISOString(),
        mine: m.senderId === participantId,
        body: m.body,
      }));
    }),
  };
}

/** Flat CSV (one row per field) so the export opens in Excel without surprises. */
export function bundleToCsvRows(bundle: PersonalDataBundle): (string | number | null)[][] {
  const rows: (string | number | null)[][] = [];
  const profile = bundle.profile;
  const push = (section: string, field: string, value: string | number | null) =>
    rows.push([section, field, value]);
  push("Profil", "Prénom", profile.firstName);
  push("Profil", "Nom", profile.lastName);
  push("Profil", "Courriel", profile.email);
  push("Profil", "Téléphone", profile.phone);
  push("Profil", "Titre", profile.jobTitle);
  push("Profil", "Entreprise", profile.companyName);
  push("Profil", "Secteur", profile.sector);
  push("Profil", "Site web", profile.website);
  push("Profil", "Ville", profile.city);
  push("Profil", "Région", profile.region);
  push("Profil", "Offres", profile.offers.join(" | "));
  push("Profil", "Besoins", profile.needs.join(" | "));
  push("Profil", "Secteurs recherchés", profile.soughtSectors.join(" | "));
  push("Profil", "Description", profile.description);
  push("Profil", "Créé le", profile.createdAt);
  for (const registration of bundle.registrations) {
    push("Inscription", registration.event, `${registration.status} · ${registration.source}`);
    for (const match of registration.matches)
      push(
        "Jumelage",
        registration.event,
        `${match.name} (${match.company}) — ${match.reasons.join(" ")}`,
      );
    for (const table of registration.tables)
      push("Table", registration.event, `Ronde ${table.round} : ${table.table}`);
  }
  for (const consent of bundle.consents) push("Consentement", consent.acceptedAt, consent.version);
  for (const request of bundle.deletionRequests)
    push("Demande de suppression", request.requestedAt, request.status);
  for (const contact of bundle.contacts)
    push(
      "Contact",
      contact.company,
      [contact.event, contact.note].filter(Boolean).join(" — ") || null,
    );
  for (const message of bundle.messages)
    push(
      "Message",
      `${message.mine ? "À" : "De"} ${message.with} · ${message.sentAt}`,
      message.body,
    );
  return rows;
}

/** The participant asks for deletion (from their space); the privacy officer is notified. */
export async function requestDeletion(
  participant: Participant,
  organization: Organization,
): Promise<DeletionRequest> {
  const pending = await prisma.deletionRequest.findFirst({
    where: { participantId: participant.id, status: "PENDING" },
  });
  if (pending) return pending;
  const request = await prisma.deletionRequest.create({
    data: { organizationId: organization.id, participantId: participant.id },
  });
  await audit({
    organizationId: organization.id,
    actorType: "participant",
    actorId: participant.id,
    action: "DATA_REQUEST",
    entity: "DeletionRequest",
    entityId: request.id,
  });
  try {
    await sendEmail({
      organization,
      to: organization.privacyEmail,
      subject: `Demande de suppression : ${participant.firstName} ${participant.lastName}`,
      template: "deletion_requested",
      react: DeletionRequestedEmail({
        brand: emailBrandOf(organization),
        participantName: `${participant.firstName} ${participant.lastName}`,
        participantEmail: participant.email,
        queueUrl: `${appBaseUrl()}/admin/participants/suppressions`,
      }),
    });
  } catch (error) {
    logger.error({ err: error }, "deletion request notification failed");
  }
  return request;
}

/**
 * Anonymizes the participant (irreversible), confirms by email to the address being erased, and
 * closes every pending request. Works with or without a prior request (organizer-initiated).
 */
export async function anonymizeParticipant(
  organizationId: string,
  participantId: string,
  actor: { organizerId: string; note?: string | null },
): Promise<void> {
  const [organization, participant] = await Promise.all([
    prisma.organization.findUniqueOrThrow({ where: { id: organizationId } }),
    prisma.participant.findFirst({ where: { id: participantId, organizationId } }),
  ]);
  if (!participant) throw new NotFoundError("Ce participant est introuvable.");
  if (participant.deletedAt) throw new AppError("Ce participant est déjà anonymisé.");

  // The confirmation goes out first: after the update there is no address left to write to.
  await sendEmail({
    organization,
    to: participant.email,
    subject: "Vos renseignements personnels ont été supprimés",
    template: "deletion_confirmed",
    react: DeletionConfirmedEmail({
      brand: emailBrandOf(organization),
      firstName: participant.firstName,
      privacyEmail: organization.privacyEmail,
    }),
  });
  await prisma.$transaction([
    prisma.participant.update({
      where: { id: participantId },
      data: anonymizedParticipantData(participantId),
    }),
    prisma.eventRegistration.updateMany({
      where: { participantId },
      data: anonymizedRegistrationData,
    }),
    prisma.consentLog.updateMany({
      where: { participantId },
      data: { ipAddress: null, userAgent: null },
    }),
    prisma.message.deleteMany({ where: { senderId: participantId } }),
    prisma.conversation.deleteMany({
      where: { OR: [{ participantAId: participantId }, { participantBId: participantId }] },
    }),
    prisma.contact.deleteMany({
      where: { OR: [{ ownerId: participantId }, { contactId: participantId }] },
    }),
    prisma.deletionRequest.updateMany({
      where: { participantId, status: "PENDING" },
      data: {
        status: "COMPLETED",
        resolvedAt: new Date(),
        resolvedById: actor.organizerId,
        note: actor.note ?? null,
      },
    }),
  ]);
  await audit({
    organizationId,
    actorType: "organizer",
    actorId: actor.organizerId,
    action: "DELETE",
    entity: "Participant",
    entityId: participantId,
    metadata: { anonymized: true, note: actor.note ?? null },
  });
}

export async function rejectDeletionRequest(
  organizationId: string,
  requestId: string,
  actor: { organizerId: string; note: string },
): Promise<void> {
  const request = await prisma.deletionRequest.findFirst({
    where: { id: requestId, organizationId, status: "PENDING" },
  });
  if (!request) throw new NotFoundError("Cette demande est introuvable ou déjà traitée.");
  await prisma.deletionRequest.update({
    where: { id: requestId },
    data: {
      status: "REJECTED",
      resolvedAt: new Date(),
      resolvedById: actor.organizerId,
      note: actor.note,
    },
  });
  await audit({
    organizationId,
    actorType: "organizer",
    actorId: actor.organizerId,
    action: "UPDATE",
    entity: "DeletionRequest",
    entityId: requestId,
    metadata: { status: "REJECTED" },
  });
}
