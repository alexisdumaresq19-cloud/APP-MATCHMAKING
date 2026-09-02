import { describe, expect, it } from "vitest";
import { matchesFingerprint } from "@/lib/publication";
import { roundLabel, roundStartsAt, seatingSeed, tableName } from "@/lib/rounds";

describe("rounds", () => {
  const event = { startsAt: new Date("2026-10-02T22:00:00Z"), roundMinutes: 20 };

  it("starts round 1 at the event start and chains the following rounds", () => {
    expect(roundStartsAt(event, 1).toISOString()).toBe("2026-10-02T22:00:00.000Z");
    expect(roundStartsAt(event, 3).toISOString()).toBe("2026-10-02T22:40:00.000Z");
    expect(roundStartsAt({ ...event, roundMinutes: null }, 2).toISOString()).toBe(
      "2026-10-02T22:20:00.000Z",
    );
  });

  it("labels rounds and tables in French", () => {
    expect(roundLabel(2, 3)).toBe("Ronde 2 de 3");
    expect(roundLabel(1, 1)).toBe("Placement");
    expect(tableName({ number: 4, label: null })).toBe("Table 4");
    expect(tableName({ number: 4, label: "  Salon bleu " })).toBe("Salon bleu");
    expect(tableName({ number: 4, label: "   " })).toBe("Table 4");
  });

  it("derives a stable, non-zero seed from the event id", () => {
    expect(seatingSeed("clx123")).toBe(seatingSeed("clx123"));
    expect(seatingSeed("clx123")).not.toBe(seatingSeed("clx124"));
    expect(seatingSeed("")).toBeGreaterThan(0);
  });
});

describe("matchesFingerprint", () => {
  it("ignores the order of partners and seats", () => {
    const a = matchesFingerprint({
      partnerRegistrationIds: ["r2", "r1"],
      seats: [
        { round: 2, tableId: "tB" },
        { round: 1, tableId: "tA" },
      ],
    });
    const b = matchesFingerprint({
      partnerRegistrationIds: ["r1", "r2"],
      seats: [
        { round: 1, tableId: "tA" },
        { round: 2, tableId: "tB" },
      ],
    });
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it("changes when a partner or a seat changes", () => {
    const base = matchesFingerprint({
      partnerRegistrationIds: ["r1"],
      seats: [{ round: 1, tableId: "tA" }],
    });
    expect(
      matchesFingerprint({
        partnerRegistrationIds: ["r1", "r3"],
        seats: [{ round: 1, tableId: "tA" }],
      }),
    ).not.toBe(base);
    expect(
      matchesFingerprint({ partnerRegistrationIds: ["r1"], seats: [{ round: 1, tableId: "tB" }] }),
    ).not.toBe(base);
    expect(matchesFingerprint({ partnerRegistrationIds: [], seats: [] })).not.toBe(base);
  });
});
