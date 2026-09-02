import type { ReactNode } from "react";
import { AnimatedIcon, type AnimatedIconName } from "@/components/ui/animated-icon";
import { cn } from "@/lib/utils";

/**
 * Friendly empty state: one animated icon (plays once on load), a short title, an optional
 * explanation and an optional action. Used for every "nothing here yet" in the app.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  size = "md",
  className,
}: {
  icon: AnimatedIconName;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-lg border border-dashed text-center",
        size === "md" ? "p-8" : "p-5",
        className,
      )}
    >
      <div
        className={cn(
          "flex items-center justify-center rounded-full bg-brand/10",
          size === "md" ? "size-14" : "size-11",
        )}
      >
        <AnimatedIcon name={icon} size={size === "md" ? 28 : 22} play />
      </div>
      <p className={cn("mt-3 font-semibold", size === "md" ? "text-lg" : "text-base")}>{title}</p>
      {description ? (
        <div className="mt-1 max-w-prose text-base text-muted-foreground">{description}</div>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
