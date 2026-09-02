import { cache } from "react";
import { prisma } from "@/lib/db/prisma";
import { pairKey } from "@/lib/matching";

/** Affinity from which a sector is pre-checked in "Avec qui aimeriez-vous collaborer ?". */
export const SUGGESTION_MIN_AFFINITY = 65;
/** Maximum number of pre-checked sectors. */
export const SUGGESTION_MAX = 4;

export type SuggestedSectorsMap = Record<string, string[]>;

/**
 * For every active sector, the other active sectors it collaborates with most, according to the
 * organization's affinity matrix (score ≥ 65, best first, 4 max). Used to pre-check the
 * "Avec qui aimeriez-vous collaborer ?" list, as the client's guideline suggests.
 */
export const suggestedSectorsMap = cache(
  async (organizationId: string): Promise<SuggestedSectorsMap> => {
    const [sectors, rows] = await Promise.all([
      prisma.sector.findMany({
        where: { organizationId, isActive: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: { id: true },
      }),
      prisma.sectorAffinity.findMany({
        where: { organizationId, score: { gte: SUGGESTION_MIN_AFFINITY } },
        select: { fromSectorId: true, toSectorId: true, score: true },
      }),
    ]);
    const score = new Map<string, number>();
    for (const row of rows) score.set(pairKey(row.fromSectorId, row.toSectorId), row.score);
    const map: SuggestedSectorsMap = {};
    for (const sector of sectors) {
      map[sector.id] = sectors
        .filter((other) => other.id !== sector.id)
        .map((other) => ({ id: other.id, score: score.get(pairKey(sector.id, other.id)) ?? 0 }))
        .filter((entry) => entry.score >= SUGGESTION_MIN_AFFINITY)
        .sort((x, y) => y.score - x.score)
        .slice(0, SUGGESTION_MAX)
        .map((entry) => entry.id);
    }
    return map;
  },
);

/** Keeps only ids of sectors that belong to the organization (deduplicated, input order). */
export async function validSoughtSectorIds(
  organizationId: string,
  ids: readonly string[],
): Promise<string[]> {
  const unique = [...new Set(ids)];
  if (!unique.length) return [];
  const known = await prisma.sector.findMany({
    where: { organizationId, id: { in: unique } },
    select: { id: true },
  });
  const allowed = new Set(known.map((s) => s.id));
  return unique.filter((id) => allowed.has(id));
}
