import { describe, expect, it } from "vitest";
import { IMPORT_TEMPLATE, analyzeRegistrantsCsv } from "@/lib/import/registrants";

const sectors = [
  { id: "s-garderie", name: "Garderie / petite enfance", slug: "garderie-petite-enfance" },
  {
    id: "s-entretien",
    name: "Entretien ménager et commercial",
    slug: "entretien-menager-commercial",
  },
  { id: "s-educ", name: "Ressources éducatives", slug: "ressources-educatives" },
];

const HEADER =
  "courriel;prenom;nom;telephone;titre;entreprise;secteur;region;ville;site_web;description;offres;besoins;secteurs_recherches;objectif";

function csv(...rows: string[]): string {
  return [HEADER, ...rows].join("\n");
}

describe("analyzeRegistrantsCsv — sought sectors", () => {
  it("parses the template, including the sought sectors column", () => {
    const analysis = analyzeRegistrantsCsv(IMPORT_TEMPLATE, sectors);
    expect(analysis.errors).toEqual([]);
    expect(analysis.rows).toHaveLength(1);
    expect(analysis.rows[0].sectorId).toBe("s-garderie");
    expect(analysis.rows[0].soughtSectorIds).toEqual(["s-entretien", "s-educ"]);
    expect(analysis.rows[0].needs).toEqual(["entretien ménager", "traiteur"]);
  });

  it("accepts sought sectors by name or slug, without free-text needs", () => {
    const analysis = analyzeRegistrantsCsv(
      csv(
        "a@exemple.quebec;A;B;;;Cie;Garderie / petite enfance;Montréal;Montréal;;;garde;;entretien-menager-commercial|ressources educatives|Entretien ménager et commercial;",
      ),
      sectors,
    );
    expect(analysis.errors).toEqual([]);
    expect(analysis.rows[0].needs).toEqual([]);
    expect(analysis.rows[0].soughtSectorIds).toEqual(["s-entretien", "s-educ"]);
  });

  it("reports an unknown sought sector and a row with neither needs nor sectors", () => {
    const analysis = analyzeRegistrantsCsv(
      csv(
        "a@exemple.quebec;A;B;;;Cie;Garderie / petite enfance;Montréal;Montréal;;;garde;;Plomberie;",
        "b@exemple.quebec;C;D;;;Cie 2;Garderie / petite enfance;Montréal;Montréal;;;garde;;;",
      ),
      sectors,
    );
    expect(analysis.rows).toEqual([]);
    expect(analysis.errors.map((e) => [e.line, e.field])).toEqual([
      [2, "secteurs_recherches"],
      [3, "besoins"],
    ]);
  });

  it("does not require the besoins column any more", () => {
    const analysis = analyzeRegistrantsCsv(
      "courriel;prenom;nom;entreprise;secteur;region;ville;offres;secteurs_recherches\n" +
        "a@exemple.quebec;A;B;Cie;Garderie / petite enfance;Montréal;Montréal;garde;Ressources éducatives",
      sectors,
    );
    expect(analysis.missingColumns).toEqual([]);
    expect(analysis.rows).toHaveLength(1);
  });
});
