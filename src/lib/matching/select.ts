import { scoreAllPairs } from "./score";
import {
  pairKey,
  type Affinity,
  type Candidate,
  type MatchReasons,
  type PairScore,
  type Rules,
} from "./types";

export type SelectionInput = {
  candidates: Candidate[];
  rules: Rules;
  affinity: Affinity;
  /** Target number of matches per participant (a minimum aimed for, not a strict maximum). */
  matchesPerParticipant: number;
  /** Pair keys (see pairKey) forced in. */
  pinned?: Set<string>;
  /** Pair keys never proposed. */
  excluded?: Set<string>;
};

export type SelectedMatch = {
  aId: string;
  bId: string;
  score: number;
  reasons: MatchReasons;
  pinned: boolean;
  /** 1-based rank in a's list. */
  rank: number;
};

export type LoweredThreshold = { registrationId: string; matches: number; threshold: number };

export type SelectionSummary = {
  eligible: number;
  pairsScored: number;
  pairsExcluded: number;
  totalMatches: number;
  averageScore: number;
  countByRegistration: Record<string, number>;
  /** Participants for whom the threshold had to be lowered (still fewer than 2 matches possible). */
  lowered: LoweredThreshold[];
  withFewerThanTwo: string[];
};

export type SelectionResult = {
  matches: SelectedMatch[];
  summary: SelectionSummary;
  pairScores: PairScore[];
};

function byScoreDesc(a: PairScore, b: PairScore): number {
  return b.score - a.score || (a.aId + a.bId < b.aId + b.bId ? -1 : 1);
}

/**
 * Selection per participant (section 7.4):
 * 1. every eligible pair is scored; 2. pinned pairs are forced, excluded pairs removed;
 * 3. each participant keeps their best `matchesPerParticipant` pairs above the threshold
 *    (a pair kept by one side is kept for both, so quotas can be exceeded);
 * 4. participants left with fewer than 2 matches get their threshold lowered in steps of 10.
 */
export function selectMatches(input: SelectionInput): SelectionResult {
  const pinned = input.pinned ?? new Set<string>();
  const excludedKeys = input.excluded ?? new Set<string>();
  const pairScores = scoreAllPairs(input.candidates, input.rules, input.affinity);

  const eligiblePairs: PairScore[] = [];
  let pairsExcluded = 0;
  const byRegistration = new Map<string, PairScore[]>();
  for (const candidate of input.candidates) byRegistration.set(candidate.registrationId, []);

  for (const pair of pairScores) {
    const key = pairKey(pair.aId, pair.bId);
    if (excludedKeys.has(key)) {
      pairsExcluded += 1;
      continue;
    }
    if (pair.excluded && !pinned.has(key)) {
      pairsExcluded += 1;
      continue;
    }
    eligiblePairs.push(pair);
    byRegistration.get(pair.aId)?.push(pair);
    byRegistration.get(pair.bId)?.push(pair);
  }
  for (const pairs of byRegistration.values()) pairs.sort(byScoreDesc);

  const selected = new Map<string, PairScore>();
  const quota = Math.max(1, input.matchesPerParticipant);

  // Pinned pairs first.
  for (const pair of eligiblePairs) {
    if (pinned.has(pairKey(pair.aId, pair.bId))) selected.set(pairKey(pair.aId, pair.bId), pair);
  }
  // Best pairs above the global threshold.
  for (const [, pairs] of byRegistration) {
    let kept = 0;
    for (const pair of pairs) {
      if (kept >= quota) break;
      if (pair.score < input.rules.minScoreToPropose) break;
      selected.set(pairKey(pair.aId, pair.bId), pair);
      kept += 1;
    }
  }

  const countFor = (registrationId: string): number => {
    let count = 0;
    for (const pair of selected.values())
      if (pair.aId === registrationId || pair.bId === registrationId) count += 1;
    return count;
  };

  // Lower the threshold for participants with fewer than 2 matches.
  const lowered: LoweredThreshold[] = [];
  for (const [registrationId, pairs] of byRegistration) {
    let count = countFor(registrationId);
    if (count >= 2) continue;
    let threshold = input.rules.minScoreToPropose;
    while (count < 2 && threshold > 0) {
      threshold = Math.max(0, threshold - 10);
      for (const pair of pairs) {
        if (count >= 2) break;
        const key = pairKey(pair.aId, pair.bId);
        if (selected.has(key) || pair.score < threshold) continue;
        selected.set(key, pair);
        count += 1;
      }
    }
    lowered.push({ registrationId, matches: count, threshold });
  }

  // Ranks (in a's list) and summary.
  const countByRegistration: Record<string, number> = {};
  for (const candidate of input.candidates) countByRegistration[candidate.registrationId] = 0;
  const selectedList = [...selected.values()].sort(byScoreDesc);
  const rankCounters = new Map<string, number>();
  const matches: SelectedMatch[] = selectedList.map((pair) => {
    countByRegistration[pair.aId] = (countByRegistration[pair.aId] ?? 0) + 1;
    countByRegistration[pair.bId] = (countByRegistration[pair.bId] ?? 0) + 1;
    const rank = (rankCounters.get(pair.aId) ?? 0) + 1;
    rankCounters.set(pair.aId, rank);
    return {
      aId: pair.aId,
      bId: pair.bId,
      score: pair.score,
      reasons: pair.reasons,
      pinned: pinned.has(pairKey(pair.aId, pair.bId)),
      rank,
    };
  });
  const averageScore = matches.length
    ? Math.round(matches.reduce((sum, m) => sum + m.score, 0) / matches.length)
    : 0;
  const withFewerThanTwo = Object.entries(countByRegistration)
    .filter(([, count]) => count < 2)
    .map(([id]) => id);

  return {
    matches,
    pairScores,
    summary: {
      eligible: input.candidates.length,
      pairsScored: pairScores.length,
      pairsExcluded,
      totalMatches: matches.length,
      averageScore,
      countByRegistration,
      lowered,
      withFewerThanTwo,
    },
  };
}
