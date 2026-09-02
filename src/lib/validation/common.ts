import { z } from "zod";
import { REGIONS } from "@/lib/regions";
import {
  TAG_MAX_COUNT,
  TAG_MAX_LENGTH,
  dedupeTags,
  parsePhoneE164,
  parseWebsite,
} from "@/lib/normalize";

export const emailSchema = z
  .string({ error: "Entrez une adresse courriel." })
  .trim()
  .toLowerCase()
  .max(254, "L'adresse courriel est trop longue.")
  .pipe(z.email({ error: "Entrez une adresse courriel valide." }));

export const nameSchema = z
  .string({ error: "Ce champ est requis." })
  .trim()
  .min(1, "Ce champ est requis.")
  .max(80, "80 caractères maximum.");

export function optionalText(max: number) {
  return z
    .string()
    .trim()
    .max(max, `${max} caractères maximum.`)
    .optional()
    .transform((value) => (value ? value : null));
}

export const phoneSchema = z
  .string()
  .trim()
  .max(30, "Le numéro est trop long.")
  .optional()
  .transform((value, ctx) => {
    const result = parsePhoneE164(value);
    if (!result.ok) {
      ctx.addIssue({
        code: "custom",
        message: "Entrez un numéro de téléphone valide (ex. : 514 555-0199).",
      });
      return z.NEVER;
    }
    return result.value;
  });

export const websiteSchema = z
  .string()
  .trim()
  .max(200, "L'adresse est trop longue.")
  .optional()
  .transform((value, ctx) => {
    const result = parseWebsite(value);
    if (!result.ok) {
      ctx.addIssue({
        code: "custom",
        message: "Entrez une adresse de site web valide (ex. : monsite.com).",
      });
      return z.NEVER;
    }
    return result.value;
  });

export const tagsSchema = z
  .array(z.string().max(200))
  .transform((tags) => dedupeTags(tags))
  .pipe(
    z
      .array(z.string().min(1).max(TAG_MAX_LENGTH))
      .min(1, "Ajoutez au moins un élément.")
      .max(TAG_MAX_COUNT, `${TAG_MAX_COUNT} éléments maximum.`),
  );

export const regionSchema = z.enum(REGIONS, { error: "Choisissez une région." });

export const sectorIdSchema = z
  .string({ error: "Choisissez un secteur." })
  .min(1, "Choisissez un secteur.")
  .max(64);

export const cuidSchema = z.string().min(1).max(64);

export const checkboxSchema = z.preprocess(
  (value) => value === "on" || value === "true" || value === true,
  z.boolean(),
);

export function optionalInt(min: number, max: number) {
  return z.preprocess(
    (value) => (value === "" || value === null || value === undefined ? undefined : value),
    z.coerce
      .number({ error: "Entrez un nombre entier." })
      .int("Entrez un nombre entier.")
      .min(min, `Minimum : ${min}.`)
      .max(max, `Maximum : ${max}.`)
      .optional(),
  );
}

export function requiredInt(min: number, max: number) {
  return z.coerce
    .number({ error: "Entrez un nombre entier." })
    .int("Entrez un nombre entier.")
    .min(min, `Minimum : ${min}.`)
    .max(max, `Maximum : ${max}.`);
}

export type FieldErrors = Record<string, string[] | undefined>;

/** Flattens a Zod error into { field: [messages] } for display under form fields. */
export function fieldErrorsOf(error: z.ZodError): FieldErrors {
  return z.flattenError(error).fieldErrors as FieldErrors;
}

/** Converts FormData into a plain object; listed keys become arrays (formData.getAll). */
export function formDataToObject(
  formData: FormData,
  options: { arrays?: string[] } = {},
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const arrays = new Set(options.arrays ?? []);
  for (const key of new Set(formData.keys())) {
    if (key.startsWith("$")) continue; // Next.js internal fields
    if (arrays.has(key)) {
      result[key] = formData
        .getAll(key)
        .filter((value): value is string => typeof value === "string");
    } else {
      const value = formData.get(key);
      result[key] = typeof value === "string" ? value : undefined;
    }
  }
  for (const key of arrays) if (!(key in result)) result[key] = [];
  return result;
}
