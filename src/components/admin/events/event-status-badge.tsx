"use client";

import type { EventStatus } from "@prisma/client";
import { AnimatedBadge, type AnimatedBadgeStatus } from "@/components/motion/animated-badge";
import { eventStatusLabel } from "@/lib/labels";

const STATUS: Record<EventStatus, AnimatedBadgeStatus> = {
  DRAFT: "neutral",
  OPEN: "success",
  CLOSED: "warning",
  MATCHED: "info",
  PUBLISHED: "success",
  COMPLETED: "neutral",
  ARCHIVED: "neutral",
};

export function EventStatusBadge({
  status,
  className,
}: {
  status: EventStatus;
  className?: string;
}) {
  return (
    <AnimatedBadge
      status={STATUS[status]}
      size="sm"
      pulse={status === "OPEN"}
      contentKey={status}
      className={className}
    >
      {eventStatusLabel(status)}
    </AnimatedBadge>
  );
}
