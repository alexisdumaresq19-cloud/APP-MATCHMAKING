import { z } from "zod";

const optionalFilter = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().trim().max(100).optional(),
);

/** Filters of the public companies directory (Phase 2, D-36). */
export const companiesQuerySchema = z.object({
  q: optionalFilter,
  secteur: optionalFilter,
  region: optionalFilter,
  page: z.coerce.number().int().min(1).default(1),
});

export type CompaniesQuery = z.infer<typeof companiesQuerySchema>;
