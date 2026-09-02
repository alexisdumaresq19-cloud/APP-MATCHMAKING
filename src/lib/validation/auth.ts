import { z } from "zod";
import { emailSchema } from "./common";

export const PASSWORD_MIN_LENGTH = 10;

export const passwordSchema = z
  .string({ error: "Entrez un mot de passe." })
  .min(
    PASSWORD_MIN_LENGTH,
    `Le mot de passe doit contenir au moins ${PASSWORD_MIN_LENGTH} caractères.`,
  )
  .max(128, "Le mot de passe est trop long.");

export const loginSchema = z.object({
  email: emailSchema,
  password: z
    .string({ error: "Entrez votre mot de passe." })
    .min(1, "Entrez votre mot de passe.")
    .max(128),
  callbackUrl: z.string().max(500).optional(),
});

export const magicLinkRequestSchema = z.object({ email: emailSchema });

export const passwordResetRequestSchema = z.object({ email: emailSchema });

export const passwordResetSchema = z
  .object({
    token: z.string().min(1).max(200),
    password: passwordSchema,
    confirm: z.string().max(128),
  })
  .refine((data) => data.password === data.confirm, {
    path: ["confirm"],
    error: "Les deux mots de passe ne correspondent pas.",
  });

export const magicLinkConsumeSchema = z.object({
  token: z.string().min(1).max(200),
  callbackUrl: z.string().max(500).optional(),
});
