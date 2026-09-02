/** Pure data types for the matching engine (no Prisma dependency). */

export type Candidate = {
  registrationId: string;
  participantId: string;
  /** Normalized company name (see `companyKey` in src/lib/normalize.ts). */
  companyKey: string;
  sectorId: string | null;
  /** Display name of the sector, used only for readable reasons. */
  sectorName?: string | null;
  region: string | null;
  /** Display tags (as typed); comparison is normalized internally. */
  offers: string[];
  needs: string[];
  /** participantIds met at a past event (same table). */
  previouslyMetIds: Set<string>;
};

export type Rules = {
  weightComplementarity: number;
  weightSectorAffinity: number;
  weightRegion: number;
  weightNovelty: number;
  /** Subtracted (× 0.5) when both share a sector; ≥ 100 excludes the pair. */
  penaltySameSector: number;
  excludeSameCompany: boolean;
  minScoreToPropose: number;
};

export const DEFAULT_RULES: Rules = {
  weightComplementarity: 40,
  weightSectorAffinity: 30,
  weightRegion: 15,
  weightNovelty: 15,
  penaltySameSector: 60,
  excludeSameCompany: true,
  minScoreToPropose: 35,
};

/** Affinity between two sectors, 0..100 (50 when unknown). */
export type Affinity = (sectorA: string, sectorB: string) => number;

export type ExclusionReason = "same_sector" | "same_company";

export type MatchReasons = {
  complementarity: { score: number; aOffersBNeeds: string[]; bOffersANeeds: string[] };
  sectorAffinity: { score: number; sectors: [string | null, string | null] };
  region: { score: number; same: boolean; neighbors: boolean; region: string | null };
  novelty: { score: number; previouslyMet: boolean };
  penalties: { type: ExclusionReason; amount: number }[];
};

export type PairScore = {
  /** Always aId < bId (string order of registration ids). */
  aId: string;
  bId: string;
  /** 0..100, computed even when the pair is excluded (used for pinned pairs). */
  score: number;
  excluded: boolean;
  exclusionReason: ExclusionReason | null;
  reasons: MatchReasons;
};

export function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

export function orderPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}
