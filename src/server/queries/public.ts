import { cache } from "react";
import type { Event, EventStatus, Organization } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

export const getOrganizationBySlug = cache(async (slug: string): Promise<Organization | null> => {
  if (!slug || slug.length > 80) return null;
  return prisma.organization.findUnique({ where: { slug } });
});

export type PublicEvent = Event & {
  organization: Organization;
  activeRegistrations: number;
};

export const getPublicEvent = cache(
  async (orgSlug: string, eventSlug: string): Promise<PublicEvent | null> => {
    if (!orgSlug || !eventSlug || orgSlug.length > 80 || eventSlug.length > 80) return null;
    const event = await prisma.event.findFirst({
      where: { slug: eventSlug, organization: { slug: orgSlug } },
      include: {
        organization: true,
        _count: { select: { registrations: { where: { status: { not: "CANCELLED" } } } } },
      },
    });
    if (!event) return null;
    const { _count, ...rest } = event;
    return { ...rest, activeRegistrations: _count.registrations };
  },
);

export const getActiveSectors = cache(async (organizationId: string) =>
  prisma.sector.findMany({
    where: { organizationId, isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true },
  }),
);

export type AvailabilityReason =
  "open" | "draft" | "not_open_yet" | "closed" | "full" | "completed" | "archived";

export type Availability = { open: boolean; reason: AvailabilityReason; opensAt?: Date | null };

const CLOSED_STATUSES: EventStatus[] = ["CLOSED", "MATCHED", "PUBLISHED"];

/** Decides whether the public form accepts registrations right now. */
export function registrationAvailability(
  event: Pick<
    Event,
    "status" | "capacity" | "registrationOpensAt" | "registrationClosesAt" | "startsAt"
  > & { activeRegistrations: number },
  now = new Date(),
): Availability {
  if (event.status === "DRAFT") return { open: false, reason: "draft" };
  if (event.status === "ARCHIVED") return { open: false, reason: "archived" };
  if (event.status === "COMPLETED") return { open: false, reason: "completed" };
  if (CLOSED_STATUSES.includes(event.status)) return { open: false, reason: "closed" };
  if (event.registrationOpensAt && event.registrationOpensAt > now) {
    return { open: false, reason: "not_open_yet", opensAt: event.registrationOpensAt };
  }
  if (event.registrationClosesAt && event.registrationClosesAt <= now) {
    return { open: false, reason: "closed" };
  }
  if (event.startsAt <= now) return { open: false, reason: "closed" };
  if (event.capacity !== null && event.activeRegistrations >= event.capacity) {
    return { open: false, reason: "full" };
  }
  return { open: true, reason: "open" };
}
