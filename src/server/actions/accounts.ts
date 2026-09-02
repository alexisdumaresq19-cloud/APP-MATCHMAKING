"use server";

import { revalidatePath } from "next/cache";
import type { OrganizerRole } from "@prisma/client";
import { requireOrganizerAction } from "@/lib/auth/session";
import { isAppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { fieldErrorsOf, formDataToObject } from "@/lib/validation/common";
import { inviteOrganizerSchema } from "@/lib/validation/organization";
import {
  inviteOrganizer,
  resendInvitation,
  setOrganizerActive,
  setOrganizerRole,
} from "@/server/services/accounts";
import { GENERIC_ERROR, type ActionState } from "./types";

const PATH = "/admin/settings/comptes";

async function requireOwnerAction() {
  const context = await requireOrganizerAction();
  if (context.organizer.role !== "OWNER") {
    throw Object.assign(new Error("owner"), { owner: true });
  }
  return context;
}

const NOT_OWNER: ActionState = {
  ok: false,
  formError: "Seul un propriétaire peut gérer les comptes.",
};

export async function invite(_previous: ActionState, formData: FormData): Promise<ActionState> {
  let context;
  try {
    context = await requireOwnerAction();
  } catch {
    return NOT_OWNER;
  }
  const parsed = inviteOrganizerSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: fieldErrorsOf(parsed.error),
      formError: "Veuillez corriger les champs indiqués.",
    };
  }
  try {
    const { sent } = await inviteOrganizer(context.organization.id, parsed.data, {
      organizerId: context.organizer.id,
      organizerName: context.organizer.name,
    });
    revalidatePath(PATH);
    return {
      ok: true,
      message: sent
        ? `Invitation envoyée à ${parsed.data.email}.`
        : "Compte créé, mais le courriel n'a pas pu partir. Utilisez « Renvoyer l'invitation ».",
    };
  } catch (error) {
    if (isAppError(error)) return { ok: false, formError: error.message };
    logger.error({ err: error }, "organizer invitation failed");
    return { ok: false, formError: GENERIC_ERROR };
  }
}

export async function resendInvite(organizerId: string): Promise<ActionState> {
  let context;
  try {
    context = await requireOwnerAction();
  } catch {
    return NOT_OWNER;
  }
  try {
    const sent = await resendInvitation(context.organization.id, organizerId, {
      organizerId: context.organizer.id,
      organizerName: context.organizer.name,
    });
    return sent
      ? { ok: true, message: "Invitation renvoyée." }
      : { ok: false, formError: "Le courriel n'a pas pu être envoyé." };
  } catch (error) {
    if (isAppError(error)) return { ok: false, formError: error.message };
    logger.error({ err: error }, "invitation resend failed");
    return { ok: false, formError: GENERIC_ERROR };
  }
}

export async function changeRole(organizerId: string, role: OrganizerRole): Promise<ActionState> {
  let context;
  try {
    context = await requireOwnerAction();
  } catch {
    return NOT_OWNER;
  }
  if (role !== "OWNER" && role !== "STAFF") return { ok: false, formError: "Rôle inconnu." };
  if (organizerId === context.organizer.id) {
    return { ok: false, formError: "Demandez à un autre propriétaire de changer votre rôle." };
  }
  try {
    await setOrganizerRole(context.organization.id, organizerId, role, {
      organizerId: context.organizer.id,
      organizerName: context.organizer.name,
    });
    revalidatePath(PATH);
    return { ok: true, message: "Rôle mis à jour." };
  } catch (error) {
    if (isAppError(error)) return { ok: false, formError: error.message };
    logger.error({ err: error }, "role change failed");
    return { ok: false, formError: GENERIC_ERROR };
  }
}

export async function setActive(organizerId: string, isActive: boolean): Promise<ActionState> {
  let context;
  try {
    context = await requireOwnerAction();
  } catch {
    return NOT_OWNER;
  }
  try {
    await setOrganizerActive(context.organization.id, organizerId, isActive, {
      organizerId: context.organizer.id,
      organizerName: context.organizer.name,
    });
    revalidatePath(PATH);
    return { ok: true, message: isActive ? "Compte réactivé." : "Compte désactivé." };
  } catch (error) {
    if (isAppError(error)) return { ok: false, formError: error.message };
    logger.error({ err: error }, "account activation change failed");
    return { ok: false, formError: GENERIC_ERROR };
  }
}
