"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { SparklesIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { runMatching } from "@/server/actions/matching";

export function RunMatchingButton({
  eventId,
  hasMatches,
  disabled,
}: {
  eventId: string;
  hasMatches: boolean;
  disabled?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  return (
    <Button
      type="button"
      size="lg"
      disabled={pending || disabled}
      onClick={() =>
        startTransition(async () => {
          const result = await runMatching(eventId);
          if (result && !result.ok) toast.error(result.formError ?? "Une erreur est survenue.");
          else {
            toast.success(result?.message ?? "Matching terminé.");
            router.refresh();
          }
        })
      }
    >
      <SparklesIcon aria-hidden="true" />
      {pending ? "Calcul en cours…" : hasMatches ? "Recalculer le matching" : "Lancer le matching"}
    </Button>
  );
}
