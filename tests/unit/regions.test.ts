import { describe, expect, it } from "vitest";
import { REGIONS, REGION_NEIGHBORS, areNeighborRegions, isRegion } from "@/lib/regions";

describe("regions", () => {
  it("contains the 17 administrative regions plus Hors Québec", () => {
    expect(REGIONS).toHaveLength(18);
    expect(REGIONS).toContain("Gaspésie–Îles-de-la-Madeleine");
    expect(REGIONS[REGIONS.length - 1]).toBe("Hors Québec");
  });

  it("neighbor table is symmetric", () => {
    for (const [region, neighbors] of REGION_NEIGHBORS) {
      for (const neighbor of neighbors) {
        expect(REGION_NEIGHBORS.get(neighbor)?.has(region)).toBe(true);
      }
    }
  });

  it("matches Annex B", () => {
    expect(areNeighborRegions("Montréal", "Laval")).toBe(true);
    expect(areNeighborRegions("Laval", "Montréal")).toBe(true);
    expect(areNeighborRegions("Abitibi-Témiscamingue", "Nord-du-Québec")).toBe(true);
    expect(areNeighborRegions("Montréal", "Estrie")).toBe(false);
    expect(areNeighborRegions("Montréal", "Montréal")).toBe(false);
    expect(areNeighborRegions("Hors Québec", "Montréal")).toBe(false);
    expect(areNeighborRegions(null, "Montréal")).toBe(false);
  });

  it("validates region strings", () => {
    expect(isRegion("Laval")).toBe(true);
    expect(isRegion("laval")).toBe(false);
    expect(isRegion(42)).toBe(false);
  });
});
