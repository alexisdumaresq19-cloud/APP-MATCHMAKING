"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { ShieldAlertIcon } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { anonymize } from "@/server/actions/privacy";

/** « Anonymiser » from the participant profile (S4-05): irreversible, confirmed in a dialog. */
export function AnonymizeButton({
  participantId,
  name,
  email,
}: {
  participantId: string;
  name: string;
  email: string;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button variant="destructive" size="lg" disabled={pending}>
            <ShieldAlertIcon aria-hidden="true" />
            Anonymiser
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Anonymiser {name}?</AlertDialogTitle>
          <AlertDialogDescription>
            Un courriel de confirmation part à {email}, puis le nom, les coordonnées,
            l&apos;entreprise et le profil sont effacés et les liens personnels révoqués. Les
            inscriptions restent, sans nom, pour la facturation. Cette action est irréversible.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuler</AlertDialogCancel>
          <AlertDialogAction
            onClick={() =>
              startTransition(async () => {
                const result = await anonymize(participantId);
                if (result && !result.ok)
                  toast.error(result.formError ?? "Une erreur est survenue.");
                else toast.success(result?.message ?? "Profil anonymisé.");
              })
            }
          >
            Anonymiser définitivement
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
