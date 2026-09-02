import type { AuditAction, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { logger } from "@/lib/logger";

export type AuditActor = "organizer" | "participant" | "system";

export type AuditEntry = {
  organizationId: string;
  actorType: AuditActor;
  actorId?: string | null;
  action: AuditAction;
  entity: string;
  entityId?: string | null;
  metadata?: Prisma.InputJsonValue;
};

/** Writes an audit log entry. Never throws: auditing must not break the business action. */
export async function audit(entry: AuditEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        organizationId: entry.organizationId,
        actorType: entry.actorType,
        actorId: entry.actorId ?? null,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId ?? null,
        metadata: entry.metadata,
      },
    });
  } catch (error) {
    logger.error(
      { err: error, entry: { ...entry, metadata: undefined } },
      "audit log write failed",
    );
  }
}
