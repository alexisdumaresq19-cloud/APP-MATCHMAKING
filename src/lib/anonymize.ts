import type { Prisma } from "@prisma/client";

/**
 * Law 25 deletion (section 8): the participant row stays (registrations keep counting for
 * billing, consent logs remain as legal proof) but nothing identifying is left. The
 * `tokenVersion` bump revokes every personal link ever sent.
 */
export function anonymizedParticipantData(participantId: string): Prisma.ParticipantUpdateInput {
  const suffix = participantId.slice(-8);
  return {
    email: `supprime-${suffix}@anonyme.invalid`,
    firstName: "Participant",
    lastName: "supprimé",
    phone: null,
    companyName: "Entreprise retirée",
    jobTitle: null,
    website: null,
    city: null,
    region: null,
    offers: [],
    needs: [],
    soughtSectorIds: [],
    description: null,
    sector: { disconnect: true },
    consentedAt: null,
    deletedAt: new Date(),
    tokenVersion: { increment: 1 },
  };
}

/** Registration snapshots also carry free text: cleared with the profile. */
export const anonymizedRegistrationData: Prisma.EventRegistrationUpdateManyMutationInput = {
  offersSnapshot: [],
  needsSnapshot: [],
  soughtSectorsSnapshot: [],
  goalsText: null,
  notes: null,
};
