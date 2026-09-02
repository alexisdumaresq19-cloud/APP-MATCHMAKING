"use server";

import { revalidatePath } from "next/cache";
import { audit } from "@/lib/audit";
import { requireOrganizerAction } from "@/lib/auth/session";
import { orgSector } from "@/lib/db/org-scope";
import { prisma } from "@/lib/db/prisma";
import { isAppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { slugify } from "@/lib/normalize";
import { affinityEntriesSchema, sectorNameSchema } from "@/lib/validation/matching";
import { GENERIC_ERROR, type ActionState } from "./types";

const PATHS = ["/admin/settings/secteurs", "/admin/settings/affinites"];

async function uniqueSectorSlug(
  organizationId: string,
  name: string,
  excludeId?: string,
): Promise<string> {
  const base = slugify(name) || "secteur";
  let candidate = base;
  for (let i = 2; i < 100; i += 1) {
    const clash = await prisma.sector.findFirst({
      where: { organizationId, slug: candidate, ...(excludeId ? { id: { not: excludeId } } : {}) },
      select: { id: true },
    });
    if (!clash) return candidate;
    candidate = `${base}-${i}`;
  }
  return `${base}-${Date.now()}`;
}

export async function createSector(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { organizer, organization } = await requireOrganizerAction();
  const parsed = sectorNameSchema.safeParse(formData.get("name"));
  if (!parsed.success)
    return {
      ok: false,
      fieldErrors: { name: [parsed.error.issues[0]?.message ?? "Nom invalide."] },
    };
  try {
    const last = await prisma.sector.findFirst({
      where: { organizationId: organization.id },
      orderBy: { sortOrder: "desc" },
    });
    const sector = await prisma.sector.create({
      data: {
        organizationId: organization.id,
        name: parsed.data,
        slug: await uniqueSectorSlug(organization.id, parsed.data),
        sortOrder: (last?.sortOrder ?? -1) + 1,
      },
    });
    await audit({
      organizationId: organization.id,
      actorType: "organizer",
      actorId: organizer.id,
      action: "CREATE",
      entity: "Sector",
      entityId: sector.id,
      metadata: { name: sector.name },
    });
  } catch (error) {
    logger.error({ err: error }, "sector creation failed");
    return { ok: false, formError: GENERIC_ERROR };
  }
  for (const path of PATHS) revalidatePath(path);
  return { ok: true, message: "Secteur ajouté." };
}

export async function renameSector(sectorId: string, name: string): Promise<ActionState> {
  const { organizer, organization } = await requireOrganizerAction();
  const parsed = sectorNameSchema.safeParse(name);
  if (!parsed.success)
    return { ok: false, formError: parsed.error.issues[0]?.message ?? "Nom invalide." };
  try {
    const sector = await orgSector(organization.id, sectorId);
    await prisma.sector.update({ where: { id: sector.id }, data: { name: parsed.data } });
    await audit({
      organizationId: organization.id,
      actorType: "organizer",
      actorId: organizer.id,
      action: "UPDATE",
      entity: "Sector",
      entityId: sector.id,
      metadata: { from: sector.name, to: parsed.data },
    });
  } catch (error) {
    if (isAppError(error)) return { ok: false, formError: error.message };
    logger.error({ err: error }, "sector rename failed");
    return { ok: false, formError: GENERIC_ERROR };
  }
  for (const path of PATHS) revalidatePath(path);
  return { ok: true, message: "Secteur renommé." };
}

export async function toggleSector(sectorId: string, isActive: boolean): Promise<ActionState> {
  const { organizer, organization } = await requireOrganizerAction();
  try {
    const sector = await orgSector(organization.id, sectorId);
    await prisma.sector.update({ where: { id: sector.id }, data: { isActive } });
    await audit({
      organizationId: organization.id,
      actorType: "organizer",
      actorId: organizer.id,
      action: "UPDATE",
      entity: "Sector",
      entityId: sector.id,
      metadata: { isActive },
    });
  } catch (error) {
    if (isAppError(error)) return { ok: false, formError: error.message };
    logger.error({ err: error }, "sector toggle failed");
    return { ok: false, formError: GENERIC_ERROR };
  }
  for (const path of PATHS) revalidatePath(path);
  return { ok: true, message: isActive ? "Secteur réactivé." : "Secteur désactivé." };
}

export async function moveSector(sectorId: string, direction: "up" | "down"): Promise<ActionState> {
  const { organization } = await requireOrganizerAction();
  try {
    const sectors = await prisma.sector.findMany({
      where: { organizationId: organization.id },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
    const index = sectors.findIndex((s) => s.id === sectorId);
    if (index === -1) return { ok: false, formError: "Ce secteur est introuvable." };
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= sectors.length) return { ok: true };
    [sectors[index], sectors[target]] = [sectors[target], sectors[index]];
    await prisma.$transaction(
      sectors.map((s, i) => prisma.sector.update({ where: { id: s.id }, data: { sortOrder: i } })),
    );
  } catch (error) {
    logger.error({ err: error }, "sector move failed");
    return { ok: false, formError: GENERIC_ERROR };
  }
  for (const path of PATHS) revalidatePath(path);
  return { ok: true };
}

/** Replaces the affinity matrix (symmetric: one row per unordered pair, ids sorted). */
export async function saveAffinities(entries: unknown): Promise<ActionState> {
  const { organizer, organization } = await requireOrganizerAction();
  const parsed = affinityEntriesSchema.safeParse(entries);
  if (!parsed.success) return { ok: false, formError: "Valeurs invalides (0 à 100 attendu)." };
  try {
    const sectors = await prisma.sector.findMany({
      where: { organizationId: organization.id },
      select: { id: true },
    });
    const known = new Set(sectors.map((s) => s.id));
    const rows = new Map<string, { fromSectorId: string; toSectorId: string; score: number }>();
    for (const entry of parsed.data) {
      if (!known.has(entry.fromSectorId) || !known.has(entry.toSectorId)) continue;
      const [from, to] =
        entry.fromSectorId < entry.toSectorId
          ? [entry.fromSectorId, entry.toSectorId]
          : [entry.toSectorId, entry.fromSectorId];
      rows.set(`${from}|${to}`, { fromSectorId: from, toSectorId: to, score: entry.score });
    }
    await prisma.$transaction(
      [...rows.values()].map((row) =>
        prisma.sectorAffinity.upsert({
          where: {
            organizationId_fromSectorId_toSectorId: {
              organizationId: organization.id,
              fromSectorId: row.fromSectorId,
              toSectorId: row.toSectorId,
            },
          },
          create: { organizationId: organization.id, ...row },
          update: { score: row.score },
        }),
      ),
    );
    await audit({
      organizationId: organization.id,
      actorType: "organizer",
      actorId: organizer.id,
      action: "UPDATE",
      entity: "SectorAffinity",
      metadata: { rows: rows.size },
    });
  } catch (error) {
    logger.error({ err: error }, "affinity save failed");
    return { ok: false, formError: GENERIC_ERROR };
  }
  revalidatePath("/admin/settings/affinites");
  return { ok: true, message: "Matrice d'affinité enregistrée." };
}
