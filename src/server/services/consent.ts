import type { Organization } from "@prisma/client";
import { hashConsentText } from "@/lib/crypto";
import { prisma } from "@/lib/db/prisma";

export function currentConsentVersion(
  organization: Pick<Organization, "consentText" | "consentVersion">,
): string {
  return organization.consentVersion || hashConsentText(organization.consentText);
}

export async function hasCurrentConsent(
  participantId: string,
  consentVersion: string,
): Promise<boolean> {
  const log = await prisma.consentLog.findFirst({
    where: { participantId, consentVersion },
    select: { id: true },
  });
  return Boolean(log);
}
