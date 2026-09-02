import { ConstructionIcon } from "lucide-react";

export function ComingSoon({ title, week }: { title: string; week: number }) {
  return (
    <div className="rounded-lg border border-dashed p-8 text-center">
      <ConstructionIcon className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
      <h2 className="mt-3 text-lg font-semibold">{title}</h2>
      <p className="mt-1 text-base text-muted-foreground">
        Cette section sera livrée à la semaine {week} du plan de développement.
      </p>
    </div>
  );
}
