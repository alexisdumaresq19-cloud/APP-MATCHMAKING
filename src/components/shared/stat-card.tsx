import type { ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AnimatedIcon, type AnimatedIconName } from "@/components/ui/animated-icon";
import { cn } from "@/lib/utils";

/**
 * Key figure with an animated icon: plays once on load, replays when the card is hovered
 * (`al-group`). Keep one figure per card and a short hint under it.
 */
export function StatCard({
  icon,
  label,
  value,
  hint,
  children,
  play = true,
  className,
}: {
  icon: AnimatedIconName;
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  children?: ReactNode;
  play?: boolean;
  className?: string;
}) {
  const figure = typeof value === "number" || typeof value === "string";
  return (
    <Card className={cn("al-group", className)}>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div className="min-w-0 space-y-1.5">
          <CardDescription>{label}</CardDescription>
          <CardTitle
            className={cn(
              "leading-tight break-words tabular-nums",
              figure ? "text-3xl" : "text-xl",
            )}
          >
            {value}
          </CardTitle>
        </div>
        <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand/10">
          <AnimatedIcon name={icon} size={22} play={play} />
        </div>
      </CardHeader>
      {hint || children ? (
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          {hint ? <div>{hint}</div> : null}
          {children}
        </CardContent>
      ) : null}
    </Card>
  );
}
