import type { EventStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { eventStatusLabel } from "@/lib/labels";
import { cn } from "@/lib/utils";

const STYLES: Record<EventStatus, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  OPEN: "bg-green-100 text-green-900",
  CLOSED: "bg-amber-100 text-amber-900",
  MATCHED: "bg-blue-100 text-blue-900",
  PUBLISHED: "bg-indigo-100 text-indigo-900",
  COMPLETED: "bg-slate-200 text-slate-900",
  ARCHIVED: "bg-slate-100 text-slate-600",
};

export function EventStatusBadge({
  status,
  className,
}: {
  status: EventStatus;
  className?: string;
}) {
  return (
    <Badge variant="outline" className={cn("border-transparent", STYLES[status], className)}>
      {eventStatusLabel(status)}
    </Badge>
  );
}
