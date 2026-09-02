import { describe, expect, it } from "vitest";
import {
  describeMatch,
  scorePair,
  type Affinity,
  type Candidate,
  type Rules,
} from "@/lib/matching";
import { diceCoefficient, matchOffersToNeeds, tagsMatch } from "@/lib/matching/similarity";

const rules: Rules = {
  weightComplementarity: 40,
  weightSectorAffinity: 30,
  weightRegion: 15,
  weightNovelty: 15,
  penaltySameSector: 60,
  excludeSameCompany: true,
  minScoreToPropose: 35,
};

const affinity: Affinity = (a, b) =>
  a === b
    ? 10
    : a === "garderie" && b === "entretien"
      ? 85
      : b === "garderie" && a === "entretien"
        ? 85
        : 40;

function candidate(overrides: Partial<Candidate> & { registrationId: string }): Candidate {
  return {
    participantId: `p-${overrides.registrationId}`,
    companyKey: `company ${overrides.registrationId}`,
    sectorId: null,
    sectorName: null,
    region: null,
    offers: [],
    needs: [],
    previouslyMetIds: new Set(),
    ...overrides,
  };
}

describe("similarity", () => {
  it("dice coefficient on bigrams", () => {
    expect(diceCoefficient("night", "nacht")).toBeCloseTo(0.25, 2);
    expect(diceCoefficient("abc", "abc")).toBe(1);
    expect(diceCoefficient("a", "b")).toBe(0);
  });

  it("matches tags after normalization or when very similar", () => {
    expect(tagsMatch("Entretien ménager", "entretien menager")).toBe(true);
    expect(tagsMatch("entretien ménager", "entretien ménagers")).toBe(true);
    expect(tagsMatch("comptabilité", "photographe")).toBe(false);
    expect(tagsMatch("", "x")).toBe(false);
  });

  it("counts each need once", () => {
    const result = matchOffersToNeeds(
      ["entretien ménager", "nettoyage"],
      ["entretien menager", "traiteur"],
    );
    expect(result).toEqual({ offers: ["entretien ménager"], needsSatisfied: 1 });
  });
});

describe("scorePair", () => {
  const garderie = candidate({
    registrationId: "r1",
    sectorId: "garderie",
    sectorName: "Garderie",
    region: "Montréal",
    offers: ["garde d'enfants"],
    needs: ["entretien ménager", "traiteur"],
  });
  const entretien = candidate({
    registrationId: "r2",
    sectorId: "entretien",
    sectorName: "Entretien ménager",
    region: "Montréal",
    offers: ["entretien ménager"],
    needs: ["garderies"],
  });

  it("nominal case: complementary, high affinity, same region, never met", () => {
    const pair = scorePair(garderie, entretien, rules, affinity);
    // complementarity: 1 need satisfied / min(4, 3) = 33; affinity 85; region 100; novelty 100
    const expected = (40 * (100 / 3) + 30 * 85 + 15 * 100 + 15 * 100) / 100;
    expect(pair.score).toBe(Math.round(expected));
    expect(pair.excluded).toBe(false);
    expect(pair.reasons.complementarity.aOffersBNeeds).toEqual([]);
    expect(pair.reasons.complementarity.bOffersANeeds).toEqual(["entretien ménager"]);
    expect(pair.reasons.region).toEqual({
      score: 100,
      same: true,
      neighbors: false,
      region: "Montréal",
    });
    expect(pair.reasons.sectorAffinity.sectors).toEqual(["Garderie", "Entretien ménager"]);
  });

  it("is symmetric and always orders ids", () => {
    const ab = scorePair(garderie, entretien, rules, affinity);
    const ba = scorePair(entretien, garderie, rules, affinity);
    expect(ba.score).toBe(ab.score);
    expect(ba.aId).toBe("r1");
    expect(ba.bId).toBe("r2");
    expect(ba.reasons).toEqual(ab.reasons);
  });

  it("applies the same-sector penalty, and excludes at 100", () => {
    const other = candidate({
      ...garderie,
      registrationId: "r3",
      companyKey: "autre",
      participantId: "p3",
    });
    const penalized = scorePair(garderie, other, rules, affinity);
    // affinity same sector 10, region same 100, novelty 100, complementarity 0 → raw 4+? then -30
    const raw = (40 * 0 + 30 * 10 + 15 * 100 + 15 * 100) / 100;
    expect(penalized.score).toBe(Math.round(Math.max(0, raw - 30)));
    expect(penalized.reasons.penalties).toEqual([{ type: "same_sector", amount: 30 }]);
    const excluded = scorePair(garderie, other, { ...rules, penaltySameSector: 100 }, affinity);
    expect(excluded.excluded).toBe(true);
    expect(excluded.exclusionReason).toBe("same_sector");
  });

  it("excludes the same company (and keeps a score for pinned use)", () => {
    const twin = candidate({
      ...entretien,
      registrationId: "r4",
      participantId: "p4",
      companyKey: garderie.companyKey,
    });
    const pair = scorePair(garderie, twin, rules, affinity);
    expect(pair.excluded).toBe(true);
    expect(pair.exclusionReason).toBe("same_company");
    expect(pair.score).toBeGreaterThan(0);
    const allowed = scorePair(garderie, twin, { ...rules, excludeSameCompany: false }, affinity);
    expect(allowed.excluded).toBe(false);
  });

  it("uses neutral values without sector or region, 60 for neighbors, 0 novelty when met", () => {
    const noSector = candidate({ registrationId: "r5", region: "Laval" });
    const laurentides = candidate({
      registrationId: "r6",
      region: "Laurentides",
      previouslyMetIds: new Set(["p-r5"]),
    });
    const pair = scorePair(noSector, laurentides, rules, affinity);
    expect(pair.reasons.sectorAffinity.score).toBe(50);
    expect(pair.reasons.region.score).toBe(60);
    expect(pair.reasons.region.neighbors).toBe(true);
    expect(pair.reasons.novelty).toEqual({ score: 0, previouslyMet: true });
    const noRegion = scorePair(
      candidate({ registrationId: "r7" }),
      candidate({ registrationId: "r8" }),
      rules,
      affinity,
    );
    expect(noRegion.reasons.region.score).toBe(50);
    expect(noRegion.score).toBe(Math.round((30 * 50 + 15 * 50 + 15 * 100) / 100));
  });

  it("caps complementarity at 100 and survives zero weights", () => {
    const a = candidate({ registrationId: "r9", offers: ["a", "b", "c", "d", "e"], needs: ["x"] });
    const b = candidate({ registrationId: "r10", offers: ["x"], needs: ["a", "b", "c", "d", "e"] });
    const pair = scorePair(a, b, rules, affinity);
    expect(pair.reasons.complementarity.score).toBe(100);
    const zero = scorePair(
      a,
      b,
      {
        ...rules,
        weightComplementarity: 0,
        weightSectorAffinity: 0,
        weightRegion: 0,
        weightNovelty: 0,
      },
      affinity,
    );
    expect(zero.score).toBe(0);
  });
});

describe("sought sectors (« Avec qui aimeriez-vous collaborer ? »)", () => {
  const garderie = candidate({
    registrationId: "r1",
    sectorId: "garderie",
    sectorName: "Garderie",
    offers: ["garde d'enfants"],
    needs: [],
    soughtSectorIds: ["entretien", "animation"],
  });
  const entretien = candidate({
    registrationId: "r2",
    sectorId: "entretien",
    sectorName: "Entretien ménager",
    offers: ["entretien ménager"],
    needs: [],
    soughtSectorIds: ["bureaux", "garderie"],
  });

  it("validates the pair when each side sought the other's sector (ET) or one did (OU)", () => {
    const pair = scorePair(garderie, entretien, rules, affinity);
    // Both sought each other → 100
    expect(pair.reasons.complementarity.score).toBe(100);
    expect(pair.reasons.complementarity.bSectorSoughtByA).toBe(true);
    expect(pair.reasons.complementarity.aSectorSoughtByB).toBe(true);

    const oneWay = scorePair(
      garderie,
      { ...entretien, soughtSectorIds: ["bureaux"] },
      rules,
      affinity,
    );
    expect(oneWay.reasons.complementarity.score).toBe(70);
    expect(oneWay.reasons.complementarity.aSectorSoughtByB).toBe(false);

    const none = scorePair(
      { ...garderie, soughtSectorIds: [] },
      { ...entretien, soughtSectorIds: [] },
      rules,
      affinity,
    );
    expect(none.reasons.complementarity.score).toBe(0);
  });

  it("never lets weak free-text tags pull a sector match below the sector rule", () => {
    const a = { ...garderie, needs: ["entretien ménager", "traiteur", "photographe"] };
    const b = { ...entretien, needs: ["garderies"], soughtSectorIds: [] };
    const pair = scorePair(a, b, rules, affinity);
    // tags: 1 of min(4, 4) needs satisfied → 25; sector rule one way → 70; keep the best
    expect(pair.reasons.complementarity.score).toBe(70);
    const tagsOnly = scorePair(
      { ...a, soughtSectorIds: [] },
      { ...b, offers: ["entretien ménager", "traiteur"] },
      rules,
      affinity,
    );
    // no sector list: tags decide → 2 of 4 needs → 50
    expect(tagsOnly.reasons.complementarity.score).toBe(50);
  });

  it("explains the sought sector in plain French, for both sides", () => {
    const pair = scorePair(garderie, entretien, rules, affinity);
    const forA = describeMatch(pair.reasons, "a");
    expect(forA[0]).toBe("Vous souhaitiez rencontrer le secteur « Entretien ménager ».");
    expect(forA).toContain("Vous souhaitiez rencontrer le secteur « Entretien ménager ».");
    expect(forA).toContain("Ils cherchaient justement des entreprises de votre secteur.");
    const forB = describeMatch(pair.reasons, "b");
    expect(forB).toContain("Vous souhaitiez rencontrer le secteur « Garderie ».");
    expect(forB.length).toBeLessThanOrEqual(3);
    for (const sentence of [...forA, ...forB]) expect(sentence).not.toMatch(/\d/);
  });
});

describe("describeMatch", () => {
  it("writes readable French sentences without numbers", () => {
    const pair = scorePair(
      candidate({
        registrationId: "r1",
        sectorId: "garderie",
        region: "Montréal",
        offers: ["garde d'enfants"],
        needs: ["entretien ménager"],
      }),
      candidate({
        registrationId: "r2",
        sectorId: "entretien",
        region: "Montréal",
        offers: ["entretien ménager"],
        needs: ["garderies"],
      }),
      rules,
      affinity,
    );
    const forA = describeMatch(pair.reasons, "a");
    expect(forA[0]).toBe("Ils offrent « entretien ménager », que vous recherchez.");
    expect(forA).toContain("Vos secteurs sont très complémentaires.");
    expect(forA.length).toBeLessThanOrEqual(3);
    const forB = describeMatch(pair.reasons, "b");
    expect(forB[0]).toBe("Vous offrez « entretien ménager », qu'ils recherchent.");
    for (const sentence of [...forA, ...forB]) expect(sentence).not.toMatch(/\d/);
  });

  it("always returns at least one sentence", () => {
    const pair = scorePair(
      candidate({ registrationId: "r1" }),
      candidate({ registrationId: "r2" }),
      rules,
      affinity,
    );
    expect(describeMatch(pair.reasons, "a")).toEqual([
      "Vos profils sont compatibles selon les critères de l'organisatrice.",
    ]);
  });
});
