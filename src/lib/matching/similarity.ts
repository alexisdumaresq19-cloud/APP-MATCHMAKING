import { normalizeTag } from "@/lib/normalize";

export const TAG_SIMILARITY_THRESHOLD = 0.85;

// Tag vocabularies are small (a few hundred distinct tags per organization), so memoizing the
// normalized keys and pairwise decisions keeps O(n²) scoring fast for hundreds of participants.
const MAX_CACHE = 20_000;
const keyCache = new Map<string, string>();
const matchCache = new Map<string, boolean>();

function remember<K, V>(cache: Map<K, V>, key: K, compute: () => V): V {
  const cached = cache.get(key);
  if (cached !== undefined) return cached;
  if (cache.size >= MAX_CACHE) cache.clear();
  const value = compute();
  cache.set(key, value);
  return value;
}

export function tagKey(tag: string): string {
  return remember(keyCache, tag, () => normalizeTag(tag));
}

function bigrams(value: string): Map<string, number> {
  const grams = new Map<string, number>();
  for (let i = 0; i < value.length - 1; i += 1) {
    const gram = value.slice(i, i + 2);
    grams.set(gram, (grams.get(gram) ?? 0) + 1);
  }
  return grams;
}

/** Sørensen–Dice coefficient on character bigrams of two already-normalized strings (0..1). */
export function diceCoefficient(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const gramsA = bigrams(a);
  const gramsB = bigrams(b);
  let overlap = 0;
  for (const [gram, count] of gramsA) overlap += Math.min(count, gramsB.get(gram) ?? 0);
  return (2 * overlap) / (a.length - 1 + (b.length - 1));
}

function keysMatch(keyA: string, keyB: string): boolean {
  if (!keyA || !keyB) return false;
  if (keyA === keyB) return true;
  // Dice >= 0.85 is impossible when lengths differ by more than about 18 %: skip the bigram work.
  const longer = Math.max(keyA.length, keyB.length);
  const shorter = Math.min(keyA.length, keyB.length);
  if (shorter < 2 || (longer - shorter) / longer > 0.2) return false;
  const cacheKey = keyA < keyB ? `${keyA} ${keyB}` : `${keyB} ${keyA}`;
  return remember(
    matchCache,
    cacheKey,
    () => diceCoefficient(keyA, keyB) >= TAG_SIMILARITY_THRESHOLD,
  );
}

/** Two tags match when their normalized forms are equal or very similar (typos, plural…). */
export function tagsMatch(a: string, b: string): boolean {
  return keysMatch(tagKey(a), tagKey(b));
}

/**
 * Returns the offers (display text) that satisfy at least one need, and the number of distinct
 * needs satisfied. Each need counts once even if several offers match it.
 */
export function matchOffersToNeeds(
  offers: string[],
  needs: string[],
): { offers: string[]; needsSatisfied: number } {
  const matchedOffers: string[] = [];
  let needsSatisfied = 0;
  const offerKeys = offers.map(tagKey);
  for (const need of needs) {
    const needKey = tagKey(need);
    const position = offerKeys.findIndex((offerKey) => keysMatch(offerKey, needKey));
    if (position !== -1) {
      needsSatisfied += 1;
      if (!matchedOffers.includes(offers[position])) matchedOffers.push(offers[position]);
    }
  }
  return { offers: matchedOffers, needsSatisfied };
}
