"use client";

import { useState, useTransition } from "react";
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
import { FormAlert } from "@/components/shared/form-field";
import { requestMyDeletion } from "@/server/actions/participant-privacy";

/** « Demander la suppression de mes données » (Law 25, S4-05), confirmed in a dialog. */
export function DataRequestForm({
  token,
  pendingSince,
  privacyEmail,
}: {
  token: string;
  pendingSince: string | null;
  privacyEmail: string;
}) {
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (pendingSince || done) {
    return (
      <FormAlert
        variant="info"
        message={
          done ??
          `Votre demande du ${pendingSince} est en traitement. Vous recevrez un courriel de confirmation une fois vos données anonymisées.`
        }
      />
    );
  }

  return (
    <div className="space-y-3">
      <FormAlert message={error} />
      <AlertDialog>
        <AlertDialogTrigger
          render={
            <Button variant="outline" size="lg" disabled={pending}>
              <ShieldAlertIcon aria-hidden="true" />
              Demander la suppression de mes données
            </Button>
          }
        />
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer vos données?</AlertDialogTitle>
            <AlertDialogDescription>
              Votre nom, vos coordonnées et votre profil seront effacés et vos liens personnels
              désactivés. Vous ne recevrez plus de jumelages pour les événements à venir. Le
              responsable de la protection des renseignements personnels ({privacyEmail}) a 30 jours
              pour traiter la demande.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Garder mes données</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                startTransition(async () => {
                  const result = await requestMyDeletion(token);
                  if (result && !result.ok) {
                    setError(result.formError ?? "Une erreur est survenue.");
                    toast.error(result.formError ?? "Une erreur est survenue.");
                  } else {
                    setError(null);
                    setDone(result?.message ?? "Demande reçue.");
                    toast.success("Demande envoyée.");
                  }
                })
              }
            >
              Confirmer la demande
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
