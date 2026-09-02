import { z } from "zod";
import { checkboxSchema, cuidSchema, requiredInt } from "./common";

export const ruleSetValuesSchema = z.object({
  weightComplementarity: requiredInt(0, 100),
  weightSectorAffinity: requiredInt(0, 100),
  weightRegion: requiredInt(0, 100),
  weightNovelty: requiredInt(0, 100),
  penaltySameSector: requiredInt(0, 100),
  excludeSameCompany: checkboxSchema,
  minScoreToPropose: requiredInt(0, 100),
});

export type RuleSetValues = z.infer<typeof ruleSetValuesSchema>;

export const ruleSetNameSchema = z
  .string({ error: "Entrez un nom." })
  .trim()
  .min(2, "Entrez un nom d'au moins 2 caractères.")
  .max(60, "60 caractères maximum.");

export const sectorNameSchema = z
  .string({ error: "Entrez un nom de secteur." })
  .trim()
  .min(2, "Entrez un nom d'au moins 2 caractères.")
  .max(80, "80 caractères maximum.");

export const affinityEntriesSchema = z
  .array(
    z.object({
      fromSectorId: cuidSchema,
      toSectorId: cuidSchema,
      score: requiredInt(0, 100),
    }),
  )
  .max(2000);

export const matchStatusSchema = z.enum(["PINNED", "EXCLUDED", "PROPOSED"]);
