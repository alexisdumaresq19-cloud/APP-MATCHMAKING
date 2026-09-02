/**
 * Closed list of Québec administrative regions (plus "Hors Québec").
 * Neighbor table from Annex B of the specification, completed symmetrically.
 */
export const REGIONS = [
  "Abitibi-Témiscamingue",
  "Bas-Saint-Laurent",
  "Capitale-Nationale",
  "Centre-du-Québec",
  "Chaudière-Appalaches",
  "Côte-Nord",
  "Estrie",
  "Gaspésie–Îles-de-la-Madeleine",
  "Lanaudière",
  "Laurentides",
  "Laval",
  "Mauricie",
  "Montérégie",
  "Montréal",
  "Nord-du-Québec",
  "Outaouais",
  "Saguenay–Lac-Saint-Jean",
  "Hors Québec",
] as const;

export type Region = (typeof REGIONS)[number];

const NEIGHBOR_PAIRS: ReadonlyArray<readonly [Region, Region]> = [
  ["Montréal", "Laval"],
  ["Montréal", "Montérégie"],
  ["Montréal", "Lanaudière"],
  ["Montréal", "Laurentides"],
  ["Laval", "Laurentides"],
  ["Laval", "Lanaudière"],
  ["Montérégie", "Estrie"],
  ["Montérégie", "Centre-du-Québec"],
  ["Capitale-Nationale", "Chaudière-Appalaches"],
  ["Capitale-Nationale", "Mauricie"],
  ["Estrie", "Centre-du-Québec"],
  ["Mauricie", "Centre-du-Québec"],
  ["Mauricie", "Lanaudière"],
  ["Bas-Saint-Laurent", "Gaspésie–Îles-de-la-Madeleine"],
  ["Bas-Saint-Laurent", "Chaudière-Appalaches"],
  ["Outaouais", "Laurentides"],
  ["Saguenay–Lac-Saint-Jean", "Capitale-Nationale"],
  ["Saguenay–Lac-Saint-Jean", "Côte-Nord"],
  ["Abitibi-Témiscamingue", "Outaouais"],
  ["Abitibi-Témiscamingue", "Nord-du-Québec"],
];

function buildNeighborMap(): ReadonlyMap<Region, ReadonlySet<Region>> {
  const map = new Map<Region, Set<Region>>();
  for (const region of REGIONS) map.set(region, new Set());
  for (const [a, b] of NEIGHBOR_PAIRS) {
    map.get(a)!.add(b);
    map.get(b)!.add(a);
  }
  return map;
}

export const REGION_NEIGHBORS = buildNeighborMap();

export function isRegion(value: unknown): value is Region {
  return typeof value === "string" && (REGIONS as readonly string[]).includes(value);
}

export function areNeighborRegions(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  if (!isRegion(a) || !isRegion(b) || a === b) return false;
  return REGION_NEIGHBORS.get(a)?.has(b) ?? false;
}
