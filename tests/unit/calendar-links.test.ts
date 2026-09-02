import { describe, expect, it } from "vitest";
import { googleCalendarUrl } from "@/lib/calendar-links";

describe("googleCalendarUrl (guideline section 3: add to calendar in one click)", () => {
  const start = new Date("2026-10-02T21:30:00.000Z");

  it("builds a Google Agenda template link with UTC dates, location and details", () => {
    const url = new URL(
      googleCalendarUrl({
        title: "Rencontres d'affaires – Printemps",
        start,
        end: new Date("2026-10-03T00:30:00.000Z"),
        location: "Salle des fêtes, 1000 rue Sherbrooke O, Montréal",
        details: "Organisé par Démo Réseautage.",
      }),
    );
    expect(url.origin + url.pathname).toBe("https://calendar.google.com/calendar/render");
    expect(url.searchParams.get("action")).toBe("TEMPLATE");
    expect(url.searchParams.get("text")).toBe("Rencontres d'affaires – Printemps");
    expect(url.searchParams.get("dates")).toBe("20261002T213000Z/20261003T003000Z");
    expect(url.searchParams.get("location")).toContain("Montréal");
    expect(url.searchParams.get("details")).toBe("Organisé par Démo Réseautage.");
  });

  it("assumes two hours when the event has no end, and omits empty fields", () => {
    const url = new URL(googleCalendarUrl({ title: "5 à 7", start, location: null }));
    expect(url.searchParams.get("dates")).toBe("20261002T213000Z/20261002T233000Z");
    expect(url.searchParams.has("location")).toBe(false);
    expect(url.searchParams.has("details")).toBe(false);
  });
});
