import { z } from "zod";
import { EventStatus, RegistrationStatus } from "@prisma/client";
import { cuidSchema, optionalInt, optionalText, requiredInt } from "./common";

const localDateTime = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Entrez une date et une heure valides.");

const optionalLocalDateTime = z.preprocess(
  (value) => (value === "" || value === null ? undefined : value),
  localDateTime.optional(),
);

export const eventSchema = z.object({
  name: z
    .string({ error: "Entrez le nom de l'événement." })
    .trim()
    .min(2, "Entrez le nom de l'événement.")
    .max(120, "120 caractères maximum."),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(2, "Le lien doit contenir au moins 2 caractères.")
    .max(80, "80 caractères maximum.")
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Le lien ne peut contenir que des lettres minuscules, des chiffres et des tirets.",
    ),
  description: optionalText(5000),
  startsAt: localDateTime,
  endsAt: optionalLocalDateTime,
  venueName: optionalText(120),
  venueAddress: optionalText(300),
  capacity: optionalInt(1, 5000),
  registrationOpensAt: optionalLocalDateTime,
  registrationClosesAt: optionalLocalDateTime,
  tableCount: requiredInt(1, 200),
  seatsPerTable: requiredInt(2, 50),
  roundCount: requiredInt(1, 10),
  roundMinutes: optionalInt(5, 240),
  matchesPerParticipant: requiredInt(1, 20),
  matchingRuleSetId: z.preprocess(
    (value) => (value === "" || value === null ? undefined : value),
    cuidSchema.optional(),
  ),
});

export type EventInput = z.infer<typeof eventSchema>;

export const eventStatusSchema = z.enum(EventStatus);

export const registrationStatusSchema = z.enum(RegistrationStatus);

export const registrationNotesSchema = z.object({
  registrationId: cuidSchema,
  notes: optionalText(2000),
});

export const registrationStatusChangeSchema = z.object({
  registrationId: cuidSchema,
  status: registrationStatusSchema,
});

export const registrantsQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  statut: registrationStatusSchema.optional(),
  secteur: z.string().max(64).optional(),
  region: z.string().max(64).optional(),
  source: z.enum(["PLATFORM", "MANUAL", "IMPORT"]).optional(),
  tri: z.enum(["nom", "entreprise", "date", "statut"]).default("date"),
  ordre: z.enum(["asc", "desc"]).default("desc"),
  page: z.coerce.number().int().min(1).default(1),
});

export type RegistrantsQuery = z.infer<typeof registrantsQuerySchema>;
