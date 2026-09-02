"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { CheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AnimatedIcon } from "@/components/ui/animated-icon";
import { ActionSwap } from "@/components/shared/action-swap";
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
  const [done, setDone] = useState(false);
  const router = useRouter();
  useEffect(() => {
    if (!done) return;
    const timer = window.setTimeout(() => setDone(false), 1800);
    return () => window.clearTimeout(timer);
  }, [done]);
  const state = pending ? "loading" : done ? "success" : "idle";
  return (
    <Button
      type="button"
      size="lg"
      className="al-group"
      disabled={pending || disabled}
      aria-busy={pending || undefined}
      onClick={() =>
        startTransition(async () => {
          const result = await runMatching(eventId);
          if (result && !result.ok) toast.error(result.formError ?? "Une erreur est survenue.");
          else {
            toast.success(result?.message ?? "Matching terminé.");
            setDone(true);
            router.refresh();
          }
        })
      }
    >
      <ActionSwap id={state}>
        {state === "success" ? (
          <CheckIcon aria-hidden="true" />
        ) : (
          <AnimatedIcon
            name="sparkles"
            size={18}
            loop={pending ? 900 : undefined}
            primaryColor="currentColor"
            secondaryColor="currentColor"
          />
        )}
        {state === "loading"
          ? "Calcul en cours…"
          : state === "success"
            ? "Calcul terminé"
            : hasMatches
              ? "Recalculer le matching"
              : "Lancer le matching"}
      </ActionSwap>
    </Button>
  );
}
