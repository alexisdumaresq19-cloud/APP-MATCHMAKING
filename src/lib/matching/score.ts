import { areNeighborRegions } from "@/lib/regions";
import { matchOffersToNeeds } from "./similarity";
import {
  orderPair,
  type Affinity,
  type Candidate,
  type MatchReasons,
  type PairScore,
  type Rules,
} from "./types";

export const NEUTRAL_SCORE = 50;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function regionScore(
  a: string | null,
  b: string | null,
): { score: number; same: boolean; neighbors: boolean } {
  if (!a || !b) return { score: NEUTRAL_SCORE, same: false, neighbors: false };
  if (a === b) return { score: 100, same: true, neighbors: false };
  if (areNeighborRegions(a, b)) return { score: 60, same: false, neighbors: true };
  return { score: 20, same: false, neighbors: false };
}

/** Score of one pair (section 7.2). Deterministic and symmetric. */
export function scorePair(
  first: Candidate,
  second: Candidate,
  rules: Rules,
  affinity: Affinity,
): PairScore {
  const [aId] = orderPair(first.registrationId, second.registrationId);
  const a = first.registrationId === aId ? first : second;
  const b = a === first ? second : first;

  const aToB = matchOffersToNeeds(a.offers, b.needs);
  const bToA = matchOffersToNeeds(b.offers, a.needs);
  const denominator = Math.max(1, Math.min(4, a.needs.length + b.needs.length));
  const complementarity = Math.min(
    100,
    (100 * (aToB.needsSatisfied + bToA.needsSatisfied)) / denominator,
  );

  const sectorAffinity =
    a.sectorId && b.sectorId ? clamp(affinity(a.sectorId, b.sectorId), 0, 100) : NEUTRAL_SCORE;

  const region = regionScore(a.region, b.region);
  const previouslyMet =
    a.previouslyMetIds.has(b.participantId) || b.previouslyMetIds.has(a.participantId);
  const novelty = previouslyMet ? 0 : 100;

  const weights = [
    rules.weightComplementarity,
    rules.weightSectorAffinity,
    rules.weightRegion,
    rules.weightNovelty,
  ];
  const totalWeight = Math.max(
    1,
    weights.reduce((sum, w) => sum + Math.max(0, w), 0),
  );
  let raw =
    (Math.max(0, rules.weightComplementarity) * complementarity +
      Math.max(0, rules.weightSectorAffinity) * sectorAffinity +
      Math.max(0, rules.weightRegion) * region.score +
      Math.max(0, rules.weightNovelty) * novelty) /
    totalWeight;

  const penalties: MatchReasons["penalties"] = [];
  let excluded = false;
  let exclusionReason: PairScore["exclusionReason"] = null;

  if (a.sectorId && b.sectorId && a.sectorId === b.sectorId) {
    if (rules.penaltySameSector >= 100) {
      excluded = true;
      exclusionReason = "same_sector";
      penalties.push({ type: "same_sector", amount: 100 });
    } else {
      const amount = Math.max(0, rules.penaltySameSector) * 0.5;
      raw = Math.max(0, raw - amount);
      penalties.push({ type: "same_sector", amount });
    }
  }
  if (rules.excludeSameCompany && a.companyKey && a.companyKey === b.companyKey) {
    excluded = true;
    exclusionReason = exclusionReason ?? "same_company";
    penalties.push({ type: "same_company", amount: 100 });
  }

  return {
    aId: a.registrationId,
    bId: b.registrationId,
    score: Math.round(clamp(raw, 0, 100)),
    excluded,
    exclusionReason,
    reasons: {
      complementarity: {
        score: Math.round(complementarity),
        aOffersBNeeds: aToB.offers,
        bOffersANeeds: bToA.offers,
      },
      sectorAffinity: {
        score: Math.round(sectorAffinity),
        sectors: [a.sectorName ?? null, b.sectorName ?? null],
      },
      region: {
        score: region.score,
        same: region.same,
        neighbors: region.neighbors,
        region: region.same ? a.region : null,
      },
      novelty: { score: novelty, previouslyMet },
      penalties,
    },
  };
}

/** Scores every unordered pair. O(n²): fine up to a few hundred candidates. */
export function scoreAllPairs(
  candidates: Candidate[],
  rules: Rules,
  affinity: Affinity,
): PairScore[] {
  const sorted = [...candidates].sort((x, y) => (x.registrationId < y.registrationId ? -1 : 1));
  const pairs: PairScore[] = [];
  for (let i = 0; i < sorted.length; i += 1) {
    for (let j = i + 1; j < sorted.length; j += 1) {
      pairs.push(scorePair(sorted[i], sorted[j], rules, affinity));
    }
  }
  return pairs;
}
