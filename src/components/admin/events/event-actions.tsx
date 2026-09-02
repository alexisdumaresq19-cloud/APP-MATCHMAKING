"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { ArchiveIcon, ArchiveRestoreIcon, CopyIcon, LockIcon, UnlockIcon } from "lucide-react";
import type { EventStatus } from "@prisma/client";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { changeEventStatus, duplicateEvent } from "@/server/actions/events";

export function EventActions({ eventId, status }: { eventId: string; status: EventStatus }) {
  const [pending, startTransition] = useTransition();

  function run(fn: () => Promise<{ ok: boolean; message?: string; formError?: string } | null>) {
    startTransition(async () => {
      const result = await fn();
      if (result && !result.ok) toast.error(result.formError ?? "Une erreur est survenue.");
      else if (result?.ok) toast.success(result.message ?? "Fait.");
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Actions</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {status === "DRAFT" || status === "CLOSED" ? (
          <Button
            variant="default"
            size="lg"
            disabled={pending}
            onClick={() => run(() => changeEventStatus(eventId, "open"))}
          >
            <UnlockIcon aria-hidden="true" />
            Ouvrir les inscriptions
          </Button>
        ) : null}
        {status === "OPEN" ? (
          <Button
            variant="outline"
            size="lg"
            disabled={pending}
            onClick={() => run(() => changeEventStatus(eventId, "close"))}
          >
            <LockIcon aria-hidden="true" />
            Fermer les inscriptions
          </Button>
        ) : null}
        <Button
          variant="outline"
          size="lg"
          disabled={pending}
          onClick={() => run(() => duplicateEvent(eventId))}
        >
          <CopyIcon aria-hidden="true" />
          Dupliquer l'événement
        </Button>
        {status === "ARCHIVED" ? (
          <Button
            variant="outline"
            size="lg"
            disabled={pending}
            onClick={() => run(() => changeEventStatus(eventId, "unarchive"))}
          >
            <ArchiveRestoreIcon aria-hidden="true" />
            Restaurer (brouillon)
          </Button>
        ) : (
          <AlertDialog>
            <AlertDialogTrigger
              render={
                <Button
                  variant="ghost"
                  size="lg"
                  className="text-muted-foreground"
                  disabled={pending}
                >
                  <ArchiveIcon aria-hidden="true" />
                  Archiver
                </Button>
              }
            />
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Archiver cet événement?</AlertDialogTitle>
                <AlertDialogDescription>
                  La page publique ne sera plus accessible et l'événement disparaîtra des listes
                  courantes. Les inscriptions et les données sont conservées; vous pourrez le
                  restaurer.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction onClick={() => run(() => changeEventStatus(eventId, "archive"))}>
                  Archiver
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </CardContent>
    </Card>
  );
}
