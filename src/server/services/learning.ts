import { audit } from "@/lib/audit";
import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors";

/**
 * Learning from the surveys (P2-S3, D-38): for each pair of sectors, the share of rated matches
 * that led to a deal or a follow-up. With enough answers, the matrix gets a suggestion the
 * organizer can apply in one click. Deliberately simple and explainable (no black box).
 */
export const MIN_SAMPLE = 5;
export const STEP = 10;

export type AffinitySuggestion = {
  fromSectorId: string;
  toSectorId: string;
  fromName: string;
  toName: string;
  current: number;
  suggested: number;
  sample: number;
  successRate: number;
};

function pairKey(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

export async function affinitySuggestions(organizationId: string): Promise<AffinitySuggestion[]> {
  const [feedbacks, sectors, affinities] = await Promise.all([
    prisma.matchFeedback.findMany({
      where: { match: { event: { organizationId } }, outcome: { not: "NOT_MET" } },
      include: {
        match: {
          include: {
            a: { include: { participant: { select: { sectorId: true } } } },
            b: { include: { participant: { select: { sectorId: true } } } },
          },
        },
      },
    }),
    prisma.sector.findMany({
      where: { organizationId, isActive: true },
      select: { id: true, name: true },
    }),
    prisma.sectorAffinity.findMany({
      where: { organizationId },
      select: { fromSectorId: true, toSectorId: true, score: true },
    }),
  ]);
  const nameOf = new Map(sectors.map((s) => [s.id, s.name]));
  const affinityOf = new Map(
    affinities.map((a) => [pairKey(a.fromSectorId, a.toSectorId).join("|"), a.score]),
  );
  const stats = new Map<string, { success: number; total: number }>();
  for (const feedback of feedbacks) {
    const sa = feedback.match.a.participant.sectorId;
    const sb = feedback.match.b.participant.sectorId;
    if (!sa || !sb || sa === sb || !nameOf.has(sa) || !nameOf.has(sb)) continue;
    const key = pairKey(sa, sb).join("|");
    const entry = stats.get(key) ?? { success: 0, total: 0 };
    entry.total += 1;
    if (feedback.outcome === "DEAL" || feedback.outcome === "FOLLOW_UP") entry.success += 1;
    stats.set(key, entry);
  }
  const suggestions: AffinitySuggestion[] = [];
  for (const [key, entry] of stats) {
    if (entry.total < MIN_SAMPLE) continue;
    const [fromSectorId, toSectorId] = key.split("|");
    const current = affinityOf.get(key) ?? 50;
    const successRate = entry.success / entry.total;
    let suggested = current;
    if (successRate >= 0.6 && current < 90) suggested = Math.min(95, current + STEP);
    else if (successRate <= 0.25 && current > 25) suggested = Math.max(20, current - STEP);
    if (suggested === current) continue;
    suggestions.push({
      fromSectorId,
      toSectorId,
      fromName: nameOf.get(fromSectorId) ?? "",
      toName: nameOf.get(toSectorId) ?? "",
      current,
      suggested,
      sample: entry.total,
      successRate,
    });
  }
  return suggestions.sort((x, y) => y.sample - x.sample);
}

/** Applies one suggestion (or any manual value) to the symmetric matrix. */
export async function applyAffinity(
  organizationId: string,
  sectorA: string,
  sectorB: string,
  score: number,
  actor: { organizerId: string },
): Promise<void> {
  if (!Number.isInteger(score) || score < 0 || score > 100) throw new AppError("Score invalide.");
  const [fromSectorId, toSectorId] = pairKey(sectorA, sectorB);
  const known = await prisma.sector.count({
    where: { organizationId, id: { in: [fromSectorId, toSectorId] } },
  });
  if (known !== 2) throw new AppError("Secteur introuvable.");
  const updated = await prisma.sectorAffinity.updateMany({
    where: { organizationId, fromSectorId, toSectorId },
    data: { score },
  });
  if (updated.count === 0) {
    await prisma.sectorAffinity.create({
      data: { organizationId, fromSectorId, toSectorId, score },
    });
  }
  await audit({
    organizationId,
    actorType: "organizer",
    actorId: actor.organizerId,
    action: "UPDATE",
    entity: "SectorAffinity",
    entityId: `${fromSectorId}|${toSectorId}`,
    metadata: { score, source: "suggestion" },
  });
}
