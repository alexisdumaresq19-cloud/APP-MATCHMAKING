import type { Organizer, OrganizerTokenPurpose } from "@prisma/client";
import { randomToken, sha256Hex } from "@/lib/crypto";
import { prisma } from "@/lib/db/prisma";

export const TOKEN_TTL_MINUTES: Record<OrganizerTokenPurpose, number> = {
  MAGIC_LINK: 15,
  PASSWORD_RESET: 60,
  INVITE: 7 * 24 * 60,
};

/** Creates a single-use token and returns the raw value (only the hash is stored). */
export async function createOrganizerToken(
  organizer: Pick<Organizer, "id" | "organizationId">,
  purpose: OrganizerTokenPurpose,
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MINUTES[purpose] * 60_000);
  // Invalidate previous unused tokens of the same purpose for this organizer.
  await prisma.organizerToken.updateMany({
    where: { organizerId: organizer.id, purpose, usedAt: null },
    data: { usedAt: new Date() },
  });
  await prisma.organizerToken.create({
    data: {
      organizationId: organizer.organizationId,
      organizerId: organizer.id,
      tokenHash: sha256Hex(token),
      purpose,
      expiresAt,
    },
  });
  return { token, expiresAt };
}

/** Returns the organizer if the token is valid, without consuming it. */
export async function peekOrganizerToken(
  token: string,
  purpose: OrganizerTokenPurpose,
): Promise<Organizer | null> {
  if (!token || token.length > 200) return null;
  const record = await prisma.organizerToken.findUnique({
    where: { tokenHash: sha256Hex(token) },
    include: { organizer: true },
  });
  if (!record || record.purpose !== purpose || record.usedAt || record.expiresAt < new Date()) {
    return null;
  }
  return record.organizer.isActive ? record.organizer : null;
}

/** Atomically marks the token as used and returns its organizer; null if invalid. */
export async function consumeOrganizerToken(
  token: string,
  purpose: OrganizerTokenPurpose,
): Promise<Organizer | null> {
  if (!token || token.length > 200) return null;
  const tokenHash = sha256Hex(token);
  const consumed = await prisma.organizerToken.updateMany({
    where: { tokenHash, purpose, usedAt: null, expiresAt: { gt: new Date() } },
    data: { usedAt: new Date() },
  });
  if (consumed.count !== 1) return null;
  const record = await prisma.organizerToken.findUnique({
    where: { tokenHash },
    include: { organizer: true },
  });
  if (!record || !record.organizer.isActive) return null;
  return record.organizer;
}
