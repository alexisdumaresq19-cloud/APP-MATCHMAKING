import type { Organizer } from "@prisma/client";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/db/prisma";
import { logger } from "@/lib/logger";
import { burnPasswordVerification, verifyPassword } from "./password";

export const MAX_FAILED_LOGINS = 5;

export type LoginFailureReason = "invalid" | "locked";

export type LoginResult =
  | { ok: true; organizer: Organizer }
  | { ok: false; reason: LoginFailureReason; lockedUntil?: Date };

/** Lockout duration after `failedCount` failures: 1, 2, 4, 8 … minutes, capped at 60. */
export function lockoutMinutes(failedCount: number): number {
  if (failedCount < MAX_FAILED_LOGINS) return 0;
  return Math.min(60, 2 ** (failedCount - MAX_FAILED_LOGINS));
}

export async function findLoginCandidate(email: string): Promise<Organizer | null> {
  // Phase 1: a single organization. If the same email exists in several
  // organizations, the oldest active account wins (see IDEES_PHASE2.md).
  return prisma.organizer.findFirst({
    where: { email, isActive: true },
    orderBy: { createdAt: "asc" },
  });
}

export async function authenticateWithPassword(
  email: string,
  password: string,
): Promise<LoginResult> {
  const organizer = await findLoginCandidate(email);
  if (!organizer || !organizer.passwordHash) {
    await burnPasswordVerification();
    return { ok: false, reason: "invalid" };
  }

  const now = new Date();
  if (organizer.lockedUntil && organizer.lockedUntil > now) {
    return { ok: false, reason: "locked", lockedUntil: organizer.lockedUntil };
  }

  const valid = await verifyPassword(organizer.passwordHash, password);
  if (!valid) {
    const failedLoginCount = organizer.failedLoginCount + 1;
    const minutes = lockoutMinutes(failedLoginCount);
    const lockedUntil = minutes > 0 ? new Date(now.getTime() + minutes * 60_000) : null;
    await prisma.organizer.update({
      where: { id: organizer.id },
      data: { failedLoginCount, lockedUntil },
    });
    await audit({
      organizationId: organizer.organizationId,
      actorType: "organizer",
      actorId: organizer.id,
      action: "LOGIN_FAILED",
      entity: "Organizer",
      entityId: organizer.id,
      metadata: { failedLoginCount, lockedUntil: lockedUntil?.toISOString() ?? null },
    });
    logger.warn({ organizerId: organizer.id, failedLoginCount }, "failed login");
    return lockedUntil
      ? { ok: false, reason: "locked", lockedUntil }
      : { ok: false, reason: "invalid" };
  }

  const updated = await markLoginSuccess(organizer, "password");
  return { ok: true, organizer: updated };
}

export async function markLoginSuccess(
  organizer: Organizer,
  method: "password" | "magic_link",
): Promise<Organizer> {
  const updated = await prisma.organizer.update({
    where: { id: organizer.id },
    data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
  });
  await audit({
    organizationId: organizer.organizationId,
    actorType: "organizer",
    actorId: organizer.id,
    action: "LOGIN",
    entity: "Organizer",
    entityId: organizer.id,
    metadata: { method },
  });
  return updated;
}
