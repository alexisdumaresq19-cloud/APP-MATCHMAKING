import type { ReactNode } from "react";
import { TextReveal } from "@/components/motion/text-reveal";

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
  animateTitle = false,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  eyebrow?: ReactNode;
  /** Word-by-word reveal of the title (hero pages only: one animated title per screen). */
  animateTitle?: boolean;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 space-y-1">
        {eyebrow}
        {animateTitle ? (
          <TextReveal
            as="h1"
            text={title}
            className="text-2xl font-bold tracking-tight sm:text-3xl"
          />
        ) : (
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        )}
        {description ? <div className="text-base text-muted-foreground">{description}</div> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
