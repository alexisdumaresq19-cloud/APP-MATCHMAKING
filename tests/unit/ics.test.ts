import { describe, expect, it } from "vitest";
import { buildIcs } from "@/lib/ics";

describe("ics", () => {
  it("builds a valid VEVENT with escaped text and CRLF line endings", () => {
    const ics = buildIcs({
      uid: "evt-1@matchmaking-events",
      title: "Soirée réseautage; automne, 2026",
      description: "Ligne 1\nLigne 2",
      location: "123, rue Principale, Montréal",
      url: "https://example.com/e/demo/soiree",
      start: new Date("2026-10-15T22:00:00Z"),
      end: new Date("2026-10-16T01:00:00Z"),
      now: new Date("2026-09-01T00:00:00Z"),
    });
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("DTSTART:20261015T220000Z");
    expect(ics).toContain("DTEND:20261016T010000Z");
    expect(ics).toContain("SUMMARY:Soirée réseautage\\; automne\\, 2026");
    expect(ics).toContain("DESCRIPTION:Ligne 1\\nLigne 2");
    expect(ics).toContain("LOCATION:123\\, rue Principale\\, Montréal");
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });

  it("defaults the end to two hours after the start and folds long lines", () => {
    const ics = buildIcs({
      uid: "x",
      title: "T".repeat(120),
      start: new Date("2026-10-15T22:00:00Z"),
      now: new Date("2026-09-01T00:00:00Z"),
    });
    expect(ics).toContain("DTEND:20261016T000000Z");
    for (const line of ics.split("\r\n")) {
      expect(Buffer.byteLength(line, "utf8")).toBeLessThanOrEqual(75);
    }
  });
});
