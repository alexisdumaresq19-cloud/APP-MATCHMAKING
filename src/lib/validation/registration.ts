import { z } from "zod";
import {
  checkboxSchema,
  emailSchema,
  nameSchema,
  optionalTagsSchema,
  optionalText,
  phoneSchema,
  regionSchema,
  sectorIdListSchema,
  sectorIdSchema,
  tagsSchema,
  websiteSchema,
} from "./common";

export const personFields = {
  firstName: nameSchema,
  lastName: nameSchema,
  email: emailSchema,
  phone: phoneSchema,
  jobTitle: optionalText(100),
};

export const companyFields = {
  companyName: z
    .string({ error: "Entrez le nom de votre entreprise." })
    .trim()
    .min(1, "Entrez le nom de votre entreprise.")
    .max(120, "120 caractères maximum."),
  sectorId: sectorIdSchema,
  region: regionSchema,
  city: z
    .string({ error: "Entrez votre ville." })
    .trim()
    .min(1, "Entrez votre ville.")
    .max(80, "80 caractères maximum."),
  website: websiteSchema,
  description: optionalText(300),
};

export const NEEDS_OR_SECTORS_MESSAGE =
  "Cochez au moins un secteur avec qui collaborer, ou précisez ce que vous cherchez.";

/**
 * Needs can be expressed as free tags ("Ce que vous cherchez") and/or as sectors ("Avec qui
 * aimeriez-vous collaborer ?"). At least one of the two is required. Applied with `.check()` on
 * every final schema (Zod drops checks on `.extend()`).
 */
export function needsOrSectors(
  ctx: z.core.ParsePayload<{ needs: string[]; soughtSectorIds: string[] }>,
) {
  if (!ctx.value.needs.length && !ctx.value.soughtSectorIds.length) {
    ctx.issues.push({
      code: "custom",
      path: ["soughtSectorIds"],
      message: NEEDS_OR_SECTORS_MESSAGE,
      input: ctx.value.soughtSectorIds,
    });
  }
}

export const matchingFields = {
  offers: tagsSchema,
  needs: optionalTagsSchema,
  soughtSectorIds: sectorIdListSchema,
  goalsText: optionalText(500),
};

export const consentField = {
  consent: checkboxSchema.pipe(
    z.literal(true, { error: "Vous devez lire et accepter l'avis de confidentialité." }),
  ),
};

export const stepPersonSchema = z.object(personFields);
export const stepCompanySchema = z.object(companyFields);
export const stepMatchingSchema = z
  .object({ ...matchingFields, ...consentField })
  .check(needsOrSectors);

/** Full public registration payload (all three steps + anti-spam fields). */
export const registrationSchema = z
  .object({
    ...personFields,
    ...companyFields,
    ...matchingFields,
    ...consentField,
    // Anti-spam: honeypot must stay empty; the form must have been open for at least 3 s.
    companyFax: z.string().max(0).optional(),
    formStartedAt: z.coerce.number().optional(),
  })
  .check(needsOrSectors);

export type RegistrationInput = z.infer<typeof registrationSchema>;

/** Profile edits from the participant space (email is not editable). */
export const participantProfileFields = {
  firstName: nameSchema,
  lastName: nameSchema,
  phone: phoneSchema,
  jobTitle: optionalText(100),
  ...companyFields,
  offers: tagsSchema,
  needs: optionalTagsSchema,
  soughtSectorIds: sectorIdListSchema,
};

export const participantProfileSchema = z.object(participantProfileFields).check(needsOrSectors);

export type ParticipantProfileInput = z.infer<typeof participantProfileSchema>;

export const consentAcceptanceSchema = z.object({
  ...consentField,
  eventId: z.string().max(64).optional(),
});

export const quickRegistrationSchema = z.object({
  goalsText: optionalText(500),
  consent: checkboxSchema,
});

export const resendLinkSchema = z.object({ email: emailSchema });

export const MIN_FORM_SECONDS = 3;
