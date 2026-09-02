import { describe, expect, it } from "vitest";
import { pairKey, selectMatches, type Affinity, type Candidate, type Rules } from "@/lib/matching";

const rules: Rules = {
  weightComplementarity: 40,
  weightSectorAffinity: 30,
  weightRegion: 15,
  weightNovelty: 15,
  penaltySameSector: 60,
  excludeSameCompany: true,
  minScoreToPropose: 35,
};
const affinity: Affinity = () => 50;

function make(id: string, overrides: Partial<Candidate> = {}): Candidate {
  return {
    registrationId: id,
    participantId: `p-${id}`,
    companyKey: `company-${id}`,
    sectorId: `sector-${id}`,
    region: "Montréal",
    offers: [`offer-${id}`],
    needs: [],
    previouslyMetIds: new Set(),
    ...overrides,
  };
}

describe("selectMatches", () => {
  it("keeps at most the quota per participant unless symmetry adds more, above the threshold", () => {
    // r1 needs what r2, r3, r4 offer → strong pairs; r5 is isolated (different region, nothing in common).
    const candidates = [
      make("r1", { needs: ["offer-r2", "offer-r3", "offer-r4"] }),
      make("r2"),
      make("r3"),
      make("r4"),
      make("r5", { region: "Hors Québec" }),
    ];
    const result = selectMatches({ candidates, rules, affinity, matchesPerParticipant: 2 });
    const r1 = result.matches.filter((m) => m.aId === "r1" || m.bId === "r1");
    expect(r1.length).toBeGreaterThanOrEqual(2);
    for (const match of result.matches) expect(match.score).toBeGreaterThanOrEqual(0);
    expect(result.summary.eligible).toBe(5);
    expect(result.summary.pairsScored).toBe(10);
    expect(result.summary.countByRegistration.r1).toBe(r1.length);
    // ranks are 1-based per a (r1 is "a" in every pair it belongs to)
    const ranks = result.matches.filter((m) => m.aId === "r1").map((m) => m.rank);
    expect(ranks).toEqual(ranks.map((_, i) => i + 1));
  });

  it("respects the threshold and lowers it only for participants with fewer than two matches", () => {
    const candidates = [make("r1"), make("r2"), make("r3")]; // all mediocre pairs (score ≈ 50)
    const strict = selectMatches({
      candidates,
      rules: { ...rules, minScoreToPropose: 90 },
      affinity,
      matchesPerParticipant: 5,
    });
    // Nothing passes 90: thresholds are lowered until everyone has 2 matches (3 pairs in total).
    expect(strict.summary.lowered.length).toBeGreaterThanOrEqual(2);
    expect(strict.summary.lowered.every((l) => l.threshold < 90)).toBe(true);
    expect(strict.matches.length).toBe(3);
    expect(strict.summary.withFewerThanTwo).toEqual([]);
  });

  it("forces pinned pairs (even excluded ones) and drops excluded pairs", () => {
    const candidates = [make("r1"), make("r2", { companyKey: "company-r1" }), make("r3")];
    const pinned = new Set([pairKey("r1", "r2")]); // same company → normally excluded
    const excluded = new Set([pairKey("r1", "r3")]);
    const result = selectMatches({
      candidates,
      rules,
      affinity,
      matchesPerParticipant: 5,
      pinned,
      excluded,
    });
    const keys = result.matches.map((m) => pairKey(m.aId, m.bId));
    expect(keys).toContain(pairKey("r1", "r2"));
    expect(keys).not.toContain(pairKey("r1", "r3"));
    expect(result.matches.find((m) => m.aId === "r1" && m.bId === "r2")?.pinned).toBe(true);
    expect(result.summary.pairsExcluded).toBe(1);
  });

  it("is deterministic", () => {
    const candidates = Array.from({ length: 30 }, (_, i) =>
      make(`r${String(i).padStart(2, "0")}`, {
        needs: [`offer-r${String((i + 1) % 30).padStart(2, "0")}`],
      }),
    );
    const a = selectMatches({ candidates, rules, affinity, matchesPerParticipant: 3 });
    const b = selectMatches({ candidates, rules, affinity, matchesPerParticipant: 3 });
    expect(a.matches).toEqual(b.matches);
  });
});
