import type { ConsentTextVersion } from "@prisma/client";
import { audit } from "@/lib/audit";
import { hashConsentText } from "@/lib/crypto";
import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors";

export type ConsentVersionRow = ConsentTextVersion & {
  isCurrent: boolean;
  acceptedCount: number;
  authorName: string | null;
};

/** History of the notice, newest first, with how many participants accepted each version. */
export async function listConsentVersions(organizationId: string): Promise<ConsentVersionRow[]> {
  const [organization, versions] = await Promise.all([
    prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: { consentVersion: true, consentText: true },
    }),
    prisma.consentTextVersion.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  // Organizations created before S4-02 have a current text without a history row: show it too.
  const rows = versions.some((v) => v.version === organization.consentVersion)
    ? versions
    : [
        {
          id: "current",
          organizationId,
          version: organization.consentVersion,
          text: organization.consentText,
          createdById: null,
          note: "Texte initial",
          createdAt: new Date(0),
        },
        ...versions,
      ];
  const counts = await prisma.consentLog.groupBy({
    by: ["consentVersion"],
    where: { participant: { organizationId }, consentVersion: { in: rows.map((r) => r.version) } },
    _count: { _all: true },
  });
  const authorIds = [...new Set(rows.map((r) => r.createdById).filter(Boolean))] as string[];
  const authors = authorIds.length
    ? await prisma.organizer.findMany({
        where: { id: { in: authorIds } },
        select: { id: true, name: true },
      })
    : [];
  const authorOf = new Map(authors.map((a) => [a.id, a.name]));
  return rows.map((row) => ({
    ...row,
    isCurrent: row.version === organization.consentVersion,
    acceptedCount: counts.find((c) => c.consentVersion === row.version)?._count._all ?? 0,
    authorName: row.createdById ? (authorOf.get(row.createdById) ?? null) : null,
  }));
}

/**
 * Adopts a new notice: the organization's current text and version change, a history row is
 * written, and every participant will have to consent again (hasCurrentConsent compares versions).
 */
export async function adoptConsentText(
  organizationId: string,
  text: string,
  actor: { organizerId: string; note?: string | null },
): Promise<{ version: string; changed: boolean }> {
  // One canonical form (LF, trimmed) so the same words always hash to the same version.
  const trimmed = text.replace(/\r\n?/g, "\n").trim();
  if (trimmed.length < 50) throw new AppError("L'avis doit contenir au moins 50 caractères.");
  const version = hashConsentText(trimmed);
  const organization = await prisma.organization.findUniqueOrThrow({
    where: { id: organizationId },
    select: { consentVersion: true },
  });
  const changed = organization.consentVersion !== version;
  await prisma.$transaction([
    prisma.organization.update({
      where: { id: organizationId },
      data: { consentText: trimmed, consentVersion: version },
    }),
    prisma.consentTextVersion.upsert({
      where: { organizationId_version: { organizationId, version } },
      create: {
        organizationId,
        version,
        text: trimmed,
        createdById: actor.organizerId,
        note: actor.note ?? null,
      },
      update: {},
    }),
  ]);
  if (changed) {
    await audit({
      organizationId,
      actorType: "organizer",
      actorId: actor.organizerId,
      action: "UPDATE",
      entity: "Organization",
      entityId: organizationId,
      metadata: { consentVersion: version, note: actor.note ?? null },
    });
  }
  return { version, changed };
}
