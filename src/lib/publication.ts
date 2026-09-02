import { sha256Hex } from "@/lib/crypto";

/**
 * Fingerprint of what a registrant would receive in the "matches published" email: their partners
 * and their seats. Republishing only emails the registrants whose fingerprint changed (S3-04).
 */
export function matchesFingerprint(input: {
  partnerRegistrationIds: readonly string[];
  seats: readonly { round: number; tableId: string }[];
}): string {
  const partners = [...input.partnerRegistrationIds].sort();
  const seats = [...input.seats]
    .sort((a, b) => a.round - b.round)
    .map((seat) => `${seat.round}:${seat.tableId}`);
  return sha256Hex(JSON.stringify({ partners, seats }));
}
