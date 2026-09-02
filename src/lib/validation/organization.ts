import { z } from "zod";
import { normalizeHexColor } from "@/lib/brand";
import { isKnownTimezone } from "@/lib/timezones";
import { cuidSchema, emailSchema, nameSchema, optionalText } from "./common";

const hexColor = z
  .string()
  .trim()
  .regex(/^#?[0-9a-fA-F]{6}$/, "Entrez une couleur au format #RRGGBB.")
  .transform((value) => normalizeHexColor(value, "#000000"));

export const organizationSettingsSchema = z.object({
  name: z
    .string({ error: "Entrez le nom de l'organisation." })
    .trim()
    .min(2, "Entrez le nom de l'organisation.")
    .max(120, "120 caractères maximum."),
  platformName: z
    .string({ error: "Entrez le nom de la plateforme." })
    .trim()
    .min(2, "Entrez le nom de la plateforme.")
    .max(40, "40 caractères maximum."),
  privacyEmail: emailSchema,
  replyToEmail: emailSchema,
  timezone: z.string().refine(isKnownTimezone, "Choisissez un fuseau horaire dans la liste."),
  primaryColor: hexColor,
  accentColor: hexColor,
});

export type OrganizationSettingsInput = z.infer<typeof organizationSettingsSchema>;

export const inviteOrganizerSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  role: z.enum(["OWNER", "STAFF"], { error: "Choisissez un rôle." }),
});

export const consentTextSchema = z.object({
  text: z
    .string({ error: "Entrez le texte de l'avis." })
    .trim()
    .min(50, "L'avis doit contenir au moins 50 caractères.")
    .max(20_000, "20 000 caractères maximum.")
    // Browsers submit textarea content with CRLF; one canonical form keeps the hash stable.
    .transform((text) => text.replace(/\r\n?/g, "\n")),
  note: optionalText(200),
});

export const deletionDecisionSchema = z.object({
  requestId: cuidSchema,
  note: optionalText(500),
});

export const acceptInvitationSchema = z
  .object({
    token: z.string().min(1).max(200),
    password: z.string().min(10, "Au moins 10 caractères.").max(200),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, {
    path: ["confirm"],
    message: "Les deux mots de passe ne correspondent pas.",
  });

export const participantsQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  secteur: z.string().max(64).optional(),
  page: z.coerce.number().int().min(1).default(1),
});

export type ParticipantsQuery = z.infer<typeof participantsQuerySchema>;
