"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { BuildingIcon, EyeIcon, EyeOffIcon, ExternalLinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { setDirectoryOptIn } from "@/server/actions/participant-events";

/**
 * « Afficher mon entreprise dans l'annuaire public » (Phase 2, D-36): explicit, revocable in one
 * click, and it says exactly what becomes visible (never the name, the email or the phone).
 */
export function DirectoryVisibility({
  token,
  optIn,
  publicUrl,
}: {
  token: string;
  optIn: boolean;
  publicUrl: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <section
      id="annuaire"
      aria-labelledby="annuaire-title"
      className="scroll-mt-6 space-y-3 rounded-lg border bg-card p-4"
    >
      <h2 id="annuaire-title" className="flex items-center gap-2 text-lg font-semibold">
        <BuildingIcon className="size-5 text-brand" aria-hidden="true" />
        Annuaire public des entreprises
      </h2>
      <p className="text-sm text-muted-foreground">
        {optIn
          ? "Votre entreprise apparaît dans l'annuaire public : nom de l'entreprise, secteur, ville et région, site web, ce que vous offrez, ce que vous cherchez, les secteurs recherchés et votre description."
          : "Faites-vous connaître des autres entreprises du réseau. Seront visibles : le nom de l'entreprise, le secteur, la ville et la région, le site web, ce que vous offrez, ce que vous cherchez, les secteurs recherchés et votre description. Jamais votre nom, votre courriel ni votre téléphone."}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant={optIn ? "outline" : "default"}
          size="lg"
          disabled={pending}
          className={optIn ? "" : "bg-brand text-brand-foreground hover:bg-brand/90"}
          onClick={() =>
            startTransition(async () => {
              const result = await setDirectoryOptIn(token, !optIn);
              if (result && !result.ok) toast.error(result.formError ?? "Une erreur est survenue.");
              else {
                toast.success(result?.message ?? "Préférence enregistrée.");
                router.refresh();
              }
            })
          }
        >
          {optIn ? (
            <>
              <EyeOffIcon aria-hidden="true" />
              Retirer mon entreprise de l&apos;annuaire
            </>
          ) : (
            <>
              <EyeIcon aria-hidden="true" />
              Afficher mon entreprise dans l&apos;annuaire
            </>
          )}
        </Button>
        {optIn ? (
          <a
            href={publicUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-9 items-center gap-1.5 px-2 text-sm text-brand underline-offset-4 hover:underline"
          >
            Voir ma fiche publique
            <ExternalLinkIcon className="size-4" aria-hidden="true" />
          </a>
        ) : null}
      </div>
    </section>
  );
}
