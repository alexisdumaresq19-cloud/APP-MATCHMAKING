"use server";

import { revalidatePath } from "next/cache";
import { audit } from "@/lib/audit";
import { requireOrganizerAction } from "@/lib/auth/session";
import { orgRuleSet } from "@/lib/db/org-scope";
import { prisma } from "@/lib/db/prisma";
import { isAppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { fieldErrorsOf, formDataToObject } from "@/lib/validation/common";
import { ruleSetNameSchema, ruleSetValuesSchema } from "@/lib/validation/matching";
import { GENERIC_ERROR, type ActionState } from "./types";

function revalidate() {
  revalidatePath("/admin/settings/regles");
  revalidatePath("/admin/events", "layout");
}

export async function createRuleSet(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { organizer, organization } = await requireOrganizerAction();
  const parsed = ruleSetNameSchema.safeParse(formData.get("name"));
  if (!parsed.success)
    return {
      ok: false,
      fieldErrors: { name: [parsed.error.issues[0]?.message ?? "Nom invalide."] },
    };
  try {
    const clash = await prisma.matchingRuleSet.findFirst({
      where: { organizationId: organization.id, name: parsed.data },
    });
    if (clash) return { ok: false, fieldErrors: { name: ["Ce nom existe déjà."] } };
    const count = await prisma.matchingRuleSet.count({
      where: { organizationId: organization.id },
    });
    const ruleSet = await prisma.matchingRuleSet.create({
      data: { organizationId: organization.id, name: parsed.data, isDefault: count === 0 },
    });
    await audit({
      organizationId: organization.id,
      actorType: "organizer",
      actorId: organizer.id,
      action: "CREATE",
      entity: "MatchingRuleSet",
      entityId: ruleSet.id,
      metadata: { name: ruleSet.name },
    });
  } catch (error) {
    logger.error({ err: error }, "rule set creation failed");
    return { ok: false, formError: GENERIC_ERROR };
  }
  revalidate();
  return { ok: true, message: "Jeu de règles créé." };
}

/** Saves the weights of a rule set (from the settings page or the event's Matching tab). */
export async function updateRuleSet(
  ruleSetId: string,
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { organizer, organization } = await requireOrganizerAction();
  const parsed = ruleSetValuesSchema.safeParse(formDataToObject(formData));
  if (!parsed.success)
    return {
      ok: false,
      fieldErrors: fieldErrorsOf(parsed.error),
      formError: "Veuillez corriger les valeurs.",
    };
  try {
    const ruleSet = await orgRuleSet(organization.id, ruleSetId);
    await prisma.matchingRuleSet.update({ where: { id: ruleSet.id }, data: parsed.data });
    await audit({
      organizationId: organization.id,
      actorType: "organizer",
      actorId: organizer.id,
      action: "UPDATE",
      entity: "MatchingRuleSet",
      entityId: ruleSet.id,
      metadata: parsed.data,
    });
  } catch (error) {
    if (isAppError(error)) return { ok: false, formError: error.message };
    logger.error({ err: error }, "rule set update failed");
    return { ok: false, formError: GENERIC_ERROR };
  }
  revalidate();
  return { ok: true, message: "Règles enregistrées." };
}

export async function renameRuleSet(ruleSetId: string, name: string): Promise<ActionState> {
  const { organization } = await requireOrganizerAction();
  const parsed = ruleSetNameSchema.safeParse(name);
  if (!parsed.success)
    return { ok: false, formError: parsed.error.issues[0]?.message ?? "Nom invalide." };
  try {
    const ruleSet = await orgRuleSet(organization.id, ruleSetId);
    await prisma.matchingRuleSet.update({ where: { id: ruleSet.id }, data: { name: parsed.data } });
  } catch (error) {
    if (isAppError(error)) return { ok: false, formError: error.message };
    return { ok: false, formError: "Ce nom existe peut-être déjà." };
  }
  revalidate();
  return { ok: true, message: "Jeu de règles renommé." };
}

export async function setDefaultRuleSet(ruleSetId: string): Promise<ActionState> {
  const { organization } = await requireOrganizerAction();
  try {
    const ruleSet = await orgRuleSet(organization.id, ruleSetId);
    await prisma.$transaction([
      prisma.matchingRuleSet.updateMany({
        where: { organizationId: organization.id },
        data: { isDefault: false },
      }),
      prisma.matchingRuleSet.update({ where: { id: ruleSet.id }, data: { isDefault: true } }),
    ]);
  } catch (error) {
    if (isAppError(error)) return { ok: false, formError: error.message };
    logger.error({ err: error }, "default rule set failed");
    return { ok: false, formError: GENERIC_ERROR };
  }
  revalidate();
  return { ok: true, message: "Jeu de règles par défaut mis à jour." };
}

export async function deleteRuleSet(ruleSetId: string): Promise<ActionState> {
  const { organizer, organization } = await requireOrganizerAction();
  try {
    const ruleSet = await orgRuleSet(organization.id, ruleSetId);
    if (ruleSet.isDefault)
      return { ok: false, formError: "Choisissez d'abord un autre jeu de règles par défaut." };
    const used = await prisma.event.count({ where: { matchingRuleSetId: ruleSet.id } });
    if (used > 0)
      return { ok: false, formError: `Ce jeu de règles est utilisé par ${used} événement(s).` };
    await prisma.matchingRuleSet.delete({ where: { id: ruleSet.id } });
    await audit({
      organizationId: organization.id,
      actorType: "organizer",
      actorId: organizer.id,
      action: "DELETE",
      entity: "MatchingRuleSet",
      entityId: ruleSet.id,
      metadata: { name: ruleSet.name },
    });
  } catch (error) {
    if (isAppError(error)) return { ok: false, formError: error.message };
    logger.error({ err: error }, "rule set delete failed");
    return { ok: false, formError: GENERIC_ERROR };
  }
  revalidate();
  return { ok: true, message: "Jeu de règles supprimé." };
}
