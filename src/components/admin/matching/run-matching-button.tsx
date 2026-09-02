"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AnimatedIcon } from "@/components/ui/animated-icon";
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
      className="al-group"
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
      <AnimatedIcon
        name="sparkles"
        size={18}
        loop={pending ? 900 : undefined}
        primaryColor="currentColor"
        secondaryColor="currentColor"
      />
      {pending ? "Calcul en cours…" : hasMatches ? "Recalculer le matching" : "Lancer le matching"}
    </Button>
  );
}
