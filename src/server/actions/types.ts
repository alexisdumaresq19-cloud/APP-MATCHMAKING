import type { FieldErrors } from "@/lib/validation/common";

/** Standard shape returned by form server actions consumed with `useActionState`. */
export type ActionState =
  | { ok: true; message?: string }
  | { ok: false; formError?: string; fieldErrors?: FieldErrors; step?: number }
  | null;

export const GENERIC_ERROR = "Une erreur est survenue. Veuillez réessayer dans quelques instants.";
