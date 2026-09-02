"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ShieldAlertIcon, XIcon } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { anonymize, rejectDeletion } from "@/server/actions/privacy";
import { cn } from "@/lib/utils";

export type DeletionRequestView = {
  id: string;
  status: "PENDING" | "COMPLETED" | "REJECTED";
  requestedAtLabel: string;
  resolvedAtLabel: string | null;
  daysLeft: number;
  note: string | null;
  participant: { id: string; name: string; email: string; company: string; anonymized: boolean };
};

/** The privacy officer's queue (S4-05): anonymize (irreversible) or refuse with a reason. */
export function DeletionQueue({ requests }: { requests: DeletionRequestView[] }) {
  const [pending, startTransition] = useTransition();
  const [reasons, setReasons] = useState<Record<string, string>>({});

  return (
    <ul className="space-y-3" aria-busy={pending || undefined}>
      {requests.map((request) => {
        const open = request.status === "PENDING";
        return (
          <li
            key={request.id}
            className={cn(
              "rounded-lg border bg-card p-4",
              open && request.daysLeft <= 7 && "border-amber-400",
            )}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 font-medium">
                  <Link
                    href={`/admin/participants/${request.participant.id}`}
                    className="hover:underline"
                  >
                    {request.participant.name}
                  </Link>
                  {request.status === "PENDING" ? (
                    <Badge className="bg-amber-100 text-amber-900">À traiter</Badge>
                  ) : request.status === "COMPLETED" ? (
                    <Badge className="bg-green-100 text-green-900">Anonymisé</Badge>
                  ) : (
                    <Badge variant="outline">Refusée</Badge>
                  )}
                </p>
                <p className="text-sm text-muted-foreground">
                  {request.participant.email} · {request.participant.company}
                </p>
                <p className="text-sm text-muted-foreground">
                  Demandé le {request.requestedAtLabel}
                  {open
                    ? request.daysLeft >= 0
                      ? ` · ${request.daysLeft} jour${request.daysLeft > 1 ? "s" : ""} pour répondre`
                      : " · délai légal dépassé"
                    : request.resolvedAtLabel
                      ? ` · traité le ${request.resolvedAtLabel}`
                      : ""}
                </p>
                {request.note ? <p className="mt-1 text-sm">Note : {request.note}</p> : null}
              </div>
              {open ? (
                <div className="flex flex-col items-end gap-2">
                  <AlertDialog>
                    <AlertDialogTrigger
                      render={
                        <Button disabled={pending || request.participant.anonymized}>
                          <ShieldAlertIcon aria-hidden="true" />
                          Anonymiser
                        </Button>
                      }
                    />
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Anonymiser {request.participant.name}?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Un courriel de confirmation part à {request.participant.email}, puis le
                          nom, les coordonnées, l'entreprise et le profil sont effacés et les liens
                          personnels révoqués. Les compteurs d'inscription restent pour la
                          facturation. Cette action est irréversible.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Annuler</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() =>
                            startTransition(async () => {
                              const result = await anonymize(request.participant.id);
                              if (result && !result.ok)
                                toast.error(result.formError ?? "Une erreur est survenue.");
                              else toast.success(result?.message ?? "Anonymisé.");
                            })
                          }
                        >
                          Anonymiser définitivement
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                  <div className="flex w-full max-w-xs flex-col gap-1">
                    <Textarea
                      aria-label={`Motif du refus pour ${request.participant.name}`}
                      placeholder="Motif du refus (obligatoire, conservé)"
                      rows={2}
                      value={reasons[request.id] ?? ""}
                      onChange={(e) => setReasons((r) => ({ ...r, [request.id]: e.target.value }))}
                      className="text-sm"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={pending || !(reasons[request.id] ?? "").trim()}
                      onClick={() =>
                        startTransition(async () => {
                          const result = await rejectDeletion(
                            request.id,
                            reasons[request.id] ?? "",
                          );
                          if (result && !result.ok)
                            toast.error(result.formError ?? "Une erreur est survenue.");
                          else toast.success(result?.message ?? "Refusée.");
                        })
                      }
                    >
                      <XIcon aria-hidden="true" />
                      Refuser la demande
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
