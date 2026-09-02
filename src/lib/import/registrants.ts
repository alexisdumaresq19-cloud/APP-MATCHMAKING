import { z } from "zod";
import { stripDiacritics } from "@/lib/normalize";
import { REGIONS, type Region } from "@/lib/regions";
import {
  emailSchema,
  nameSchema,
  optionalText,
  phoneSchema,
  websiteSchema,
} from "@/lib/validation/common";
import { headerKey, parseCsv } from "./csv";

export const IMPORT_COLUMNS = [
  {
    key: "courriel",
    label: "courriel",
    required: true,
    aliases: ["email", "e_mail", "adresse_courriel"],
  },
  {
    key: "prenom",
    label: "prenom",
    required: true,
    aliases: ["prenom", "first_name", "firstname"],
  },
  {
    key: "nom",
    label: "nom",
    required: true,
    aliases: ["nom", "last_name", "lastname", "nom_de_famille"],
  },
  { key: "telephone", label: "telephone", required: false, aliases: ["tel", "phone", "telephone"] },
  {
    key: "titre",
    label: "titre",
    required: false,
    aliases: ["fonction", "poste", "title", "job_title"],
  },
  {
    key: "entreprise",
    label: "entreprise",
    required: true,
    aliases: ["company", "societe", "organisation"],
  },
  { key: "secteur", label: "secteur", required: true, aliases: ["sector", "secteur_d_activite"] },
  { key: "region", label: "region", required: true, aliases: ["region_administrative"] },
  { key: "ville", label: "ville", required: true, aliases: ["city"] },
  {
    key: "site_web",
    label: "site_web",
    required: false,
    aliases: ["site", "website", "web", "url"],
  },
  { key: "description", label: "description", required: false, aliases: [] },
  {
    key: "offres",
    label: "offres",
    required: true,
    aliases: ["offre", "offers", "ce_que_vous_offrez"],
  },
  {
    key: "besoins",
    label: "besoins",
    required: true,
    aliases: ["besoin", "needs", "ce_que_vous_cherchez"],
  },
  {
    key: "objectif",
    label: "objectif",
    required: false,
    aliases: ["objectifs", "goals", "attentes"],
  },
] as const;

export type ImportColumnKey = (typeof IMPORT_COLUMNS)[number]["key"];

export const IMPORT_TEMPLATE = `${IMPORT_COLUMNS.map((c) => c.label).join(";")}
marie.tremblay@exemple.quebec;Marie;Tremblay;514 555-0142;Propriétaire;Garderie Les Petits Pas;Garderie / petite enfance;Montréal;Montréal;petitspas.ca;Garderie de 40 places à Rosemont;garde d'enfants|camp de jour;entretien ménager|traiteur;Trouver un fournisseur d'entretien
`;

export type ImportRowError = { line: number; field: string; message: string };

export type ImportedRow = {
  line: number;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  jobTitle: string | null;
  companyName: string;
  sectorId: string;
  region: Region;
  city: string;
  website: string | null;
  description: string | null;
  offers: string[];
  needs: string[];
  goalsText: string | null;
};

export type ImportAnalysis = {
  rows: ImportedRow[];
  errors: ImportRowError[];
  totalLines: number;
  missingColumns: string[];
  duplicateEmails: string[];
};

const tagList = z
  .string()
  .transform((value) =>
    value
      .split(/[|;]/)
      .map((tag) => tag.trim())
      .filter(Boolean),
  )
  .pipe(
    z
      .array(z.string().max(40))
      .min(1, "Ajoutez au moins un élément.")
      .max(8, "8 éléments maximum."),
  );

const rowSchema = z.object({
  email: emailSchema,
  firstName: nameSchema,
  lastName: nameSchema,
  phone: phoneSchema,
  jobTitle: optionalText(100),
  companyName: z.string().trim().min(1, "L'entreprise est requise.").max(120),
  city: z.string().trim().min(1, "La ville est requise.").max(80),
  website: websiteSchema,
  description: optionalText(300),
  offers: tagList,
  needs: tagList,
  goalsText: optionalText(500),
});

function fold(value: string): string {
  return stripDiacritics(value).toLowerCase().trim();
}

function resolveColumns(header: string[]): {
  index: Partial<Record<ImportColumnKey, number>>;
  missing: string[];
} {
  const keys = header.map(headerKey);
  const index: Partial<Record<ImportColumnKey, number>> = {};
  for (const column of IMPORT_COLUMNS) {
    const names = [column.key, ...column.aliases].map(headerKey);
    const position = keys.findIndex((key) => names.includes(key));
    if (position !== -1) index[column.key] = position;
  }
  const missing = IMPORT_COLUMNS.filter((c) => c.required && index[c.key] === undefined).map(
    (c) => c.label,
  );
  return { index, missing };
}

/** Parses and validates a CSV export of registrants. Never touches the database. */
export function analyzeRegistrantsCsv(
  text: string,
  sectors: { id: string; name: string; slug: string }[],
): ImportAnalysis {
  const parsed = parseCsv(text, { maxRows: 1000 });
  const { index, missing } = resolveColumns(parsed.header);
  const analysis: ImportAnalysis = {
    rows: [],
    errors: [],
    totalLines: parsed.rows.length,
    missingColumns: missing,
    duplicateEmails: [],
  };
  if (missing.length) return analysis;

  const sectorByKey = new Map<string, string>();
  for (const sector of sectors) {
    sectorByKey.set(fold(sector.name), sector.id);
    sectorByKey.set(fold(sector.slug), sector.id);
  }
  const regionByKey = new Map<string, Region>(REGIONS.map((r) => [fold(r), r]));
  const seenEmails = new Set<string>();

  parsed.rows.forEach((cells, offset) => {
    const line = offset + 2; // header is line 1
    const get = (key: ImportColumnKey) =>
      index[key] === undefined ? "" : (cells[index[key]!] ?? "").trim();
    const result = rowSchema.safeParse({
      email: get("courriel"),
      firstName: get("prenom"),
      lastName: get("nom"),
      phone: get("telephone"),
      jobTitle: get("titre"),
      companyName: get("entreprise"),
      city: get("ville"),
      website: get("site_web"),
      description: get("description"),
      offers: get("offres"),
      needs: get("besoins"),
      goalsText: get("objectif"),
    });
    const rowErrors: ImportRowError[] = [];
    if (!result.success) {
      for (const issue of result.error.issues)
        rowErrors.push({ line, field: String(issue.path[0] ?? ""), message: issue.message });
    }
    const sectorId = sectorByKey.get(fold(get("secteur")));
    if (!sectorId)
      rowErrors.push({
        line,
        field: "secteur",
        message: `Secteur inconnu : « ${get("secteur")} ».`,
      });
    const region = regionByKey.get(fold(get("region")));
    if (!region)
      rowErrors.push({ line, field: "region", message: `Région inconnue : « ${get("region")} ».` });
    if (result.success) {
      if (seenEmails.has(result.data.email)) {
        rowErrors.push({ line, field: "courriel", message: "Courriel en double dans le fichier." });
        analysis.duplicateEmails.push(result.data.email);
      }
      seenEmails.add(result.data.email);
    }
    if (rowErrors.length || !result.success || !sectorId || !region) {
      analysis.errors.push(...rowErrors);
      return;
    }
    analysis.rows.push({ line, ...result.data, sectorId, region });
  });
  return analysis;
}
