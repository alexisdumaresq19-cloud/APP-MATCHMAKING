"use server";

import { revalidatePath } from "next/cache";
import { requireOrganizerAction } from "@/lib/auth/session";
import { isAppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { fieldErrorsOf, formDataToObject } from "@/lib/validation/common";
import { consentTextSchema } from "@/lib/validation/organization";
import { adoptConsentText } from "@/server/services/consent-versions";
import { prisma } from "@/lib/db/prisma";
import { GENERIC_ERROR, type ActionState } from "./types";

/** Adopts the text from the editor as the new current notice (a new version if it changed). */
export async function saveConsentText(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { organizer, organization } = await requireOrganizerAction();
  if (organizer.role !== "OWNER") {
    return { ok: false, formError: "Seul un propriétaire peut modifier l'avis." };
  }
  const parsed = consentTextSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: fieldErrorsOf(parsed.error),
      formError: "Veuillez corriger les champs indiqués.",
    };
  }
  try {
    const result = await adoptConsentText(organization.id, parsed.data.text, {
      organizerId: organizer.id,
      note: parsed.data.note,
    });
    revalidatePath("/admin/settings/consentement");
    revalidatePath("/admin", "layout");
    return {
      ok: true,
      message: result.changed
        ? "Nouvelle version de l'avis adoptée. Les participants devront l'accepter de nouveau."
        : "Le texte est identique à la version actuelle : rien n'a changé.",
    };
  } catch (error) {
    if (isAppError(error)) return { ok: false, formError: error.message };
    logger.error({ err: error }, "consent text save failed");
    return { ok: false, formError: GENERIC_ERROR };
  }
}

/** Makes a previous version current again (its text becomes a new adoption of the same hash). */
export async function restoreConsentVersion(versionId: string): Promise<ActionState> {
  const { organizer, organization } = await requireOrganizerAction();
  if (organizer.role !== "OWNER") {
    return { ok: false, formError: "Seul un propriétaire peut modifier l'avis." };
  }
  try {
    const version = await prisma.consentTextVersion.findFirst({
      where: { id: versionId, organizationId: organization.id },
    });
    if (!version) return { ok: false, formError: "Cette version est introuvable." };
    await adoptConsentText(organization.id, version.text, {
      organizerId: organizer.id,
      note: `Restauration de la version du ${version.createdAt.toISOString().slice(0, 10)}`,
    });
    revalidatePath("/admin/settings/consentement");
    revalidatePath("/admin", "layout");
    return { ok: true, message: "Version restaurée : elle est de nouveau l'avis en vigueur." };
  } catch (error) {
    if (isAppError(error)) return { ok: false, formError: error.message };
    logger.error({ err: error }, "consent version restore failed");
    return { ok: false, formError: GENERIC_ERROR };
  }
}
