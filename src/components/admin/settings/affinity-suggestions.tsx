"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { SparklesIcon, TrendingDownIcon, TrendingUpIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { applyAffinitySuggestion } from "@/server/actions/learning";
import type { AffinitySuggestion } from "@/server/services/learning";

/** Suggestions from the post-event surveys, applied one by one (P2-S3, D-38). */
export function AffinitySuggestions({ suggestions }: { suggestions: AffinitySuggestion[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <section className="space-y-3 rounded-lg border bg-card p-4">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <SparklesIcon className="size-5 text-brand" aria-hidden="true" />
        Suggestions d&apos;après les bilans
      </h2>
      {suggestions.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Rien à suggérer pour l&apos;instant. Dès qu&apos;au moins cinq rencontres entre deux
          secteurs auront été évaluées par les participants (bilan après l&apos;événement), la
          matrice vous proposera des ajustements ici, chiffres à l&apos;appui.
        </p>
      ) : (
        <ul className="divide-y">
          {suggestions.map((s) => {
            const up = s.suggested > s.current;
            return (
              <li
                key={`${s.fromSectorId}|${s.toSectorId}`}
                className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"
              >
                <div className="min-w-0">
                  <p className="font-medium">
                    {s.fromName} ↔ {s.toName}
                  </p>
                  <p className="text-muted-foreground">
                    {Math.round(s.successRate * 100)} % des {s.sample} rencontres évaluées ont donné
                    une affaire ou un suivi. Affinité actuelle : {s.current}.
                  </p>
                </div>
                <Button
                  type="button"
                  variant={up ? "default" : "outline"}
                  size="sm"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      const result = await applyAffinitySuggestion(
                        s.fromSectorId,
                        s.toSectorId,
                        s.suggested,
                      );
                      if (result && !result.ok)
                        toast.error(result.formError ?? "Une erreur est survenue.");
                      else {
                        toast.success(result?.message ?? "Appliqué.");
                        router.refresh();
                      }
                    })
                  }
                >
                  {up ? (
                    <TrendingUpIcon aria-hidden="true" />
                  ) : (
                    <TrendingDownIcon aria-hidden="true" />
                  )}
                  Passer à {s.suggested}
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
