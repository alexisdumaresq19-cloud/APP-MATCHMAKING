"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { audit } from "@/lib/audit";
import { requireOrganizerAction } from "@/lib/auth/session";
import { orgEvent } from "@/lib/db/org-scope";
import { prisma } from "@/lib/db/prisma";
import { isAppError } from "@/lib/errors";
import { analyzeRegistrantsCsv, type ImportAnalysis } from "@/lib/import/registrants";
import { logger } from "@/lib/logger";

export const IMPORT_MAX_BYTES = 2 * 1024 * 1024;

export type ImportReport = {
  ok: boolean;
  formError?: string;
  analysis?: Omit<ImportAnalysis, "rows"> & { valid: number; existingEmails: number };
};

async function sectorsOf(organizationId: string) {
  return prisma.sector.findMany({
    where: { organizationId },
    select: { id: true, name: true, slug: true },
  });
}

export async function analyzeImport(eventId: string, csvText: string): Promise<ImportReport> {
  const { organization } = await requireOrganizerAction();
  if (typeof csvText !== "string" || csvText.length > IMPORT_MAX_BYTES)
    return { ok: false, formError: "Fichier trop volumineux (2 Mo maximum)." };
  try {
    await orgEvent(organization.id, eventId);
    const analysis = analyzeRegistrantsCsv(csvText, await sectorsOf(organization.id));
    const existing = analysis.rows.length
      ? await prisma.participant.count({
          where: {
            organizationId: organization.id,
            email: { in: analysis.rows.map((r) => r.email) },
          },
        })
      : 0;
    const { rows, ...rest } = analysis;
    return { ok: true, analysis: { ...rest, valid: rows.length, existingEmails: existing } };
  } catch (error) {
    if (isAppError(error)) return { ok: false, formError: error.message };
    logger.error({ err: error }, "import analysis failed");
    return { ok: false, formError: "Impossible de lire ce fichier." };
  }
}

/** Imports the valid rows (source IMPORT). Existing participants keep their profile. */
export async function confirmImport(eventId: string, csvText: string): Promise<ImportReport> {
  const { organizer, organization } = await requireOrganizerAction();
  if (typeof csvText !== "string" || csvText.length > IMPORT_MAX_BYTES)
    return { ok: false, formError: "Fichier trop volumineux (2 Mo maximum)." };
  let imported = 0;
  let reused = 0;
  let skipped = 0;
  try {
    const event = await orgEvent(organization.id, eventId);
    const analysis = analyzeRegistrantsCsv(csvText, await sectorsOf(organization.id));
    if (!analysis.rows.length) return { ok: false, formError: "Aucune ligne valide à importer." };

    for (const row of analysis.rows) {
      await prisma.$transaction(async (tx) => {
        let participant = await tx.participant.findUnique({
          where: { organizationId_email: { organizationId: organization.id, email: row.email } },
        });
        if (participant?.deletedAt) participant = null;
        if (participant) reused += 1;
        else {
          participant = await tx.participant.create({
            data: {
              organizationId: organization.id,
              email: row.email,
              firstName: row.firstName,
              lastName: row.lastName,
              phone: row.phone,
              jobTitle: row.jobTitle,
              companyName: row.companyName,
              sectorId: row.sectorId,
              region: row.region,
              city: row.city,
              website: row.website,
              description: row.description,
              offers: row.offers,
              needs: row.needs,
              soughtSectorIds: row.soughtSectorIds,
            },
          });
        }
        const registration = await tx.eventRegistration.findUnique({
          where: { eventId_participantId: { eventId: event.id, participantId: participant.id } },
        });
        if (registration && registration.status !== "CANCELLED") {
          skipped += 1;
          return;
        }
        if (registration) {
          await tx.eventRegistration.update({
            where: { id: registration.id },
            data: {
              status: "REGISTERED",
              cancelledAt: null,
              source: "IMPORT",
              goalsText: row.goalsText,
            },
          });
        } else {
          await tx.eventRegistration.create({
            data: {
              eventId: event.id,
              participantId: participant.id,
              source: "IMPORT",
              offersSnapshot: participant.offers,
              needsSnapshot: participant.needs,
              soughtSectorsSnapshot: participant.soughtSectorIds,
              goalsText: row.goalsText,
            },
          });
        }
        imported += 1;
      });
    }
    await audit({
      organizationId: organization.id,
      actorType: "organizer",
      actorId: organizer.id,
      action: "CREATE",
      entity: "EventRegistration",
      entityId: event.id,
      metadata: { source: "IMPORT", imported, reused, skipped, invalid: analysis.errors.length },
    });
  } catch (error) {
    if (isAppError(error)) return { ok: false, formError: error.message };
    logger.error({ err: error }, "import failed");
    return {
      ok: false,
      formError:
        "L'importation a échoué. Aucune ligne partielle n'a été conservée pour la ligne en erreur.",
    };
  }
  revalidatePath(`/admin/events/${eventId}/inscrits`);
  revalidatePath("/admin", "layout");
  redirect(
    `/admin/events/${eventId}/inscrits?import=${imported}&reutilises=${reused}&ignores=${skipped}`,
  );
}
