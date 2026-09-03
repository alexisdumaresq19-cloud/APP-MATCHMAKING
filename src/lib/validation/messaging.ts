import { z } from "zod";
import { optionalText } from "./common";

export const MESSAGE_MAX_LENGTH = 2000;

/** One message between two companies (Phase 2, D-37). */
export const messageSchema = z.object({
  body: z
    .string({ error: "Écrivez un message." })
    .trim()
    .min(1, "Écrivez un message.")
    .max(MESSAGE_MAX_LENGTH, `${MESSAGE_MAX_LENGTH} caractères maximum.`),
});

/** Private note on a contact (« Rencontré à la table 4, rappeler en octobre »). */
export const contactNoteSchema = z.object({
  note: optionalText(500),
});
