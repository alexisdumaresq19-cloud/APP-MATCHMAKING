"use server";

import { revalidatePath } from "next/cache";
import { requireOrganizerAction } from "@/lib/auth/session";
import { isAppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { LOGO_MAX_BYTES } from "@/lib/uploads";
import { fieldErrorsOf, formDataToObject } from "@/lib/validation/common";
import { organizationSettingsSchema } from "@/lib/validation/organization";
import {
  removeOrganizationLogo,
  saveOrganizationLogo,
  updateOrganizationSettings,
} from "@/server/services/organization";
import { GENERIC_ERROR, type ActionState } from "./types";

function revalidateBrand() {
  revalidatePath("/admin", "layout");
  revalidatePath("/e", "layout");
  revalidatePath("/p", "layout");
}

export async function saveOrganizationSettings(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { organizer, organization } = await requireOrganizerAction();
  if (organizer.role !== "OWNER") {
    return { ok: false, formError: "Seul un propriétaire peut modifier l'organisation." };
  }
  const parsed = organizationSettingsSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: fieldErrorsOf(parsed.error),
      formError: "Veuillez corriger les champs indiqués.",
    };
  }
  try {
    await updateOrganizationSettings(organization.id, parsed.data, { organizerId: organizer.id });
  } catch (error) {
    if (isAppError(error)) return { ok: false, formError: error.message };
    logger.error({ err: error }, "organization settings save failed");
    return { ok: false, formError: GENERIC_ERROR };
  }
  revalidateBrand();
  return { ok: true, message: "Organisation enregistrée." };
}

/** Logo upload: the file is read from the multipart form, sniffed, capped at 2 MB (S4-01). */
export async function uploadOrganizationLogo(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { organizer, organization } = await requireOrganizerAction();
  if (organizer.role !== "OWNER") {
    return { ok: false, formError: "Seul un propriétaire peut modifier le logo." };
  }
  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, fieldErrors: { logo: ["Choisissez un fichier image."] } };
  }
  if (file.size > LOGO_MAX_BYTES) {
    return { ok: false, fieldErrors: { logo: ["Le logo doit faire 2 Mo ou moins."] } };
  }
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    await saveOrganizationLogo(organization.id, bytes, { organizerId: organizer.id });
  } catch (error) {
    if (isAppError(error)) return { ok: false, fieldErrors: { logo: [error.message] } };
    logger.error({ err: error }, "logo upload failed");
    return { ok: false, formError: GENERIC_ERROR };
  }
  revalidateBrand();
  return { ok: true, message: "Logo enregistré." };
}

export async function deleteOrganizationLogo(): Promise<ActionState> {
  const { organizer, organization } = await requireOrganizerAction();
  if (organizer.role !== "OWNER") {
    return { ok: false, formError: "Seul un propriétaire peut modifier le logo." };
  }
  try {
    await removeOrganizationLogo(organization.id, { organizerId: organizer.id });
  } catch (error) {
    if (isAppError(error)) return { ok: false, formError: error.message };
    logger.error({ err: error }, "logo removal failed");
    return { ok: false, formError: GENERIC_ERROR };
  }
  revalidateBrand();
  return { ok: true, message: "Logo retiré." };
}
