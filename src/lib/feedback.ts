import type { FeedbackOutcome } from "@prisma/client";

/** Shared between the survey form (client) and the feedback service (server). */
export const OUTCOMES = [
  "DEAL",
  "FOLLOW_UP",
  "NO_FIT",
  "NOT_MET",
] as const satisfies readonly FeedbackOutcome[];

export const OUTCOME_LABELS: Record<FeedbackOutcome, string> = {
  DEAL: "Oui : une affaire ou un partenariat",
  FOLLOW_UP: "Un suivi est prévu",
  NO_FIT: "Non, pas pour nous",
  NOT_MET: "Nous ne nous sommes pas rencontrés",
};

export type FeedbackMatchRow = {
  matchId: string;
  partnerName: string;
  partnerCompany: string;
  outcome: FeedbackOutcome | null;
  comment: string | null;
};
