import { describe, expect, it } from "vitest";
import {
  assignSeats,
  selectMatches,
  type Affinity,
  type Candidate,
  type Rules,
  type SeatingMatch,
} from "@/lib/matching";

function participants(n: number, sectors = 6) {
  return Array.from({ length: n }, (_, i) => ({
    registrationId: `r${String(i).padStart(3, "0")}`,
    sectorId: `s${i % sectors}`,
  }));
}

function ringMatches(n: number, score = 80): SeatingMatch[] {
  const matches: SeatingMatch[] = [];
  for (let i = 0; i < n; i += 1) {
    const a = `r${String(i).padStart(3, "0")}`;
    const b = `r${String((i + 1) % n).padStart(3, "0")}`;
    matches.push(a < b ? { aId: a, bId: b, score } : { aId: b, bId: a, score });
  }
  return matches;
}

describe("assignSeats", () => {
  it("respects table capacity and locked assignments", () => {
    const people = participants(20);
    const tables = [
      { id: "t1", seats: 6 },
      { id: "t2", seats: 6 },
      { id: "t3", seats: 6 },
      { id: "t4", seats: 6 },
    ];
    const { assignments, report } = assignSeats({
      participants: people,
      matches: ringMatches(20),
      tables,
      rounds: 1,
      locked: [{ registrationId: "r019", round: 1, tableId: "t1" }],
      timeBudgetMs: 5000,
    });
    expect(assignments).toHaveLength(20);
    for (const table of tables) {
      expect(assignments.filter((a) => a.tableId === table.id).length).toBeLessThanOrEqual(
        table.seats,
      );
    }
    const lockedRow = assignments.find((a) => a.registrationId === "r019");
    expect(lockedRow).toMatchObject({ tableId: "t1", isLocked: true });
    expect(report.unplaced).toEqual([]);
    expect(report.totalScore).toBeGreaterThan(0);
  });

  it("reports unplaced participants when seats are missing", () => {
    const { assignments, report } = assignSeats({
      participants: participants(10),
      matches: [],
      tables: [
        { id: "t1", seats: 4 },
        { id: "t2", seats: 4 },
      ],
      rounds: 1,
      timeBudgetMs: 1000,
    });
    expect(assignments).toHaveLength(8);
    expect(report.unplaced).toHaveLength(2);
  });

  it("avoids seating the same pair twice across rounds", () => {
    // 24 people, 6 tables of 4, 3 rounds: a repeat-free schedule exists.
    const people = participants(24, 24);
    const tables = Array.from({ length: 6 }, (_, i) => ({ id: `t${i}`, seats: 4 }));
    const { assignments, report } = assignSeats({
      participants: people,
      matches: ringMatches(24, 40),
      tables,
      rounds: 3,
      timeBudgetMs: 5000,
      maxIterations: 3000,
    });
    expect(assignments).toHaveLength(72);
    const seen = new Set<string>();
    let repeats = 0;
    for (let round = 1; round <= 3; round += 1) {
      for (const table of tables) {
        const members = assignments
          .filter((a) => a.round === round && a.tableId === table.id)
          .map((a) => a.registrationId)
          .sort();
        for (let x = 0; x < members.length; x += 1) {
          for (let y = x + 1; y < members.length; y += 1) {
            const key = `${members[x]}|${members[y]}`;
            if (seen.has(key)) repeats += 1;
            seen.add(key);
          }
        }
      }
    }
    expect(repeats).toBeLessThanOrEqual(2);
    expect(report.rounds.map((r) => r.repeatedPairs).reduce((a, b) => a + b, 0)).toBe(repeats);
  });

  it("reaches the theoretical minimum of repeats when repeats are unavoidable", () => {
    // 24 people, 4 tables of 6: every later round must seat at least 2 pairs per table again.
    const tables = Array.from({ length: 4 }, (_, i) => ({ id: `t${i}`, seats: 6 }));
    const { report } = assignSeats({
      participants: participants(24, 24),
      matches: [],
      tables,
      rounds: 2,
      timeBudgetMs: 3000,
    });
    expect(report.rounds[1].repeatedPairs).toBe(8);
  });

  it("keeps same-sector participants apart when required, and reports conflicts otherwise", () => {
    const people = participants(12, 4); // 3 per sector, 4 tables of 3 → a perfect split exists
    const tables = Array.from({ length: 4 }, (_, i) => ({ id: `t${i}`, seats: 3 }));
    const { assignments, report } = assignSeats({
      participants: people,
      matches: ringMatches(12, 30),
      tables,
      rounds: 1,
      forbidSameSector: true,
      timeBudgetMs: 5000,
    });
    for (const table of tables) {
      const sectors = assignments
        .filter((a) => a.tableId === table.id)
        .map((a) => people.find((p) => p.registrationId === a.registrationId)!.sectorId);
      expect(new Set(sectors).size).toBe(sectors.length);
    }
    expect(report.rounds[0].conflicts).toEqual([]);
  });

  it("is deterministic for a given seed", () => {
    const people = participants(40);
    const tables = Array.from({ length: 7 }, (_, i) => ({ id: `t${i}`, seats: 6 }));
    const options = {
      participants: people,
      matches: ringMatches(40),
      tables,
      rounds: 2,
      seed: 42,
      maxIterations: 1500,
      timeBudgetMs: 60_000,
    };
    const first = assignSeats(options);
    const second = assignSeats(options);
    expect(second.assignments).toEqual(first.assignments);
    const other = assignSeats({ ...options, seed: 7 });
    expect(other.report.totalScore).toBeGreaterThan(0);
  });

  it("handles 300 participants, 15 tables and 3 rounds in under 2 seconds (matching + seating)", () => {
    const rules: Rules = {
      weightComplementarity: 40,
      weightSectorAffinity: 30,
      weightRegion: 15,
      weightNovelty: 15,
      penaltySameSector: 60,
      excludeSameCompany: true,
      minScoreToPropose: 35,
    };
    const affinity: Affinity = (a, b) => (a === b ? 10 : 40 + ((a.length * 7 + b.length * 3) % 50));
    const tags = [
      "entretien ménager",
      "comptabilité",
      "site web",
      "marketing",
      "traiteur",
      "assurance",
      "photographe",
      "recrutement",
      "rénovation",
      "financement",
      "livraison",
      "formation",
    ];
    const regions = ["Montréal", "Laval", "Montérégie", "Laurentides", "Estrie"];
    const candidates: Candidate[] = Array.from({ length: 300 }, (_, i) => ({
      registrationId: `r${String(i).padStart(3, "0")}`,
      participantId: `p${i}`,
      companyKey: `company ${i}`,
      sectorId: `s${i % 18}`,
      region: regions[i % regions.length],
      offers: [tags[i % tags.length], tags[(i * 5) % tags.length]],
      needs: [
        tags[(i + 3) % tags.length],
        tags[(i * 7 + 1) % tags.length],
        tags[(i + 9) % tags.length],
      ],
      previouslyMetIds: new Set(),
    }));
    const started = performance.now();
    const selection = selectMatches({ candidates, rules, affinity, matchesPerParticipant: 5 });
    const tables = Array.from({ length: 15 }, (_, i) => ({ id: `t${i}`, seats: 20 }));
    const seating = assignSeats({
      participants: candidates.map((c) => ({
        registrationId: c.registrationId,
        sectorId: c.sectorId,
      })),
      matches: selection.matches.map((m) => ({
        aId: m.aId,
        bId: m.bId,
        score: m.score,
        pinned: m.pinned,
      })),
      tables,
      rounds: 3,
      timeBudgetMs: 500,
    });
    const elapsed = performance.now() - started;
    expect(seating.assignments).toHaveLength(900);
    expect(selection.matches.length).toBeGreaterThan(300);
    expect(elapsed).toBeLessThan(2000);
  });
});
