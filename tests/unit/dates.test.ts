import { describe, expect, it } from "vitest";
import {
  formatDate,
  formatDateRange,
  fromLocalInput,
  timezoneOffsetMinutes,
  toLocalInput,
} from "@/lib/dates";

describe("dates (America/Toronto)", () => {
  it("computes DST-aware offsets", () => {
    expect(timezoneOffsetMinutes(new Date("2026-07-01T12:00:00Z"), "America/Toronto")).toBe(-240);
    expect(timezoneOffsetMinutes(new Date("2026-01-15T12:00:00Z"), "America/Toronto")).toBe(-300);
  });

  it("round-trips datetime-local values", () => {
    const summer = fromLocalInput("2026-10-15T18:00");
    expect(summer?.toISOString()).toBe("2026-10-15T22:00:00.000Z");
    expect(toLocalInput(summer)).toBe("2026-10-15T18:00");

    const winter = fromLocalInput("2026-12-01T09:30");
    expect(winter?.toISOString()).toBe("2026-12-01T14:30:00.000Z");
    expect(toLocalInput(winter)).toBe("2026-12-01T09:30");
  });

  it("rejects malformed input", () => {
    expect(fromLocalInput("nope")).toBeNull();
    expect(fromLocalInput("")).toBeNull();
  });

  it("formats in Québec French", () => {
    const date = new Date("2026-10-15T22:00:00Z");
    expect(formatDate(date, "America/Toronto", "date")).toBe("15 octobre 2026");
    expect(formatDate(date, "America/Toronto", "time")).toMatch(/18\s?h\s?00/);
    expect(formatDateRange(date, new Date("2026-10-16T01:00:00Z"))).toMatch(
      /^jeudi 15 octobre 2026, de 18\s?h\s?00 à 21\s?h\s?00$/,
    );
    expect(formatDateRange(date, null)).toMatch(/^jeudi 15 octobre 2026, à 18\s?h\s?00$/);
  });
});
