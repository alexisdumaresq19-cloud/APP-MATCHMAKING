"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { BellRingIcon, MailCheckIcon, SendIcon, ShieldCheckIcon } from "lucide-react";
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
import { Progress } from "@/components/ui/progress";
import { ActionSwap } from "@/components/shared/action-swap";
import { publishMatches, sendBatch, startReminderRun } from "@/server/actions/publication";
import type { EmailBatchKind } from "@/server/services/publication";
import type { ActionState } from "@/server/actions/types";
import type { PublicationOverview } from "@/server/services/publication";

type RunState = {
  kind: EmailBatchKind;
  sent: number;
  failed: number;
  total: number;
  done: boolean;
};

const LABELS: Record<EmailBatchKind, { running: string; done: string }> = {
  publish: { running: "Envoi des jumelages…", done: "Jumelages envoyés" },
  reminder: { running: "Envoi du rappel…", done: "Rappel envoyé" },
  consent: { running: "Envoi des demandes de consentement…", done: "Demandes envoyées" },
};

/**
 * The three sending actions of the Publication tab. Each one calls a server action per batch of 20
 * emails until nothing remains, with a progress bar, so no request exceeds a serverless limit.
 */
export function PublishPanel({
  eventId,
  overview,
}: {
  eventId: string;
  overview: PublicationOverview;
}) {
  const router = useRouter();
  const [run, setRun] = useState<RunState | null>(null);
  const busy = Boolean(run && !run.done);

  async function loop(kind: EmailBatchKind, start?: () => Promise<ActionState>) {
    if (start) {
      const started = await start();
      if (started && !started.ok) {
        toast.error(started.formError ?? "Une erreur est survenue.");
        return;
      }
    }
    let sent = 0;
    let failed = 0;
    let total: number | null = null;
    setRun({ kind, sent, failed, total: 0, done: false });
    for (let i = 0; i < 200; i += 1) {
      const result = await sendBatch(eventId, kind);
      if (!result.ok) {
        toast.error(result.formError);
        break;
      }
      if (total === null) total = result.total;
      sent += result.sent;
      failed += result.failed;
      setRun({ kind, sent, failed, total: total ?? 0, done: false });
      // Stop when nothing is left, or when a whole batch failed (broken transport).
      if (result.remaining === 0 || (result.sent === 0 && result.failed > 0)) break;
    }
    setRun({ kind, sent, failed, total: total ?? 0, done: true });
    if (failed)
      toast.warning(`${failed} courriel${failed > 1 ? "s" : ""} n'ont pas pu être envoyés.`);
    else if (sent)
      toast.success(`${sent} courriel${sent > 1 ? "s" : ""} envoyé${sent > 1 ? "s" : ""}.`);
    else toast.info("Rien à envoyer : tout le monde est à jour.");
    router.refresh();
  }

  const canPublish =
    overview.totalMatches > 0 && !["COMPLETED", "ARCHIVED"].includes(overview.status);
  const firstTime = !overview.publishedAt;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <AlertDialog>
          <AlertDialogTrigger
            render={
              <Button
                size="lg"
                className="al-group h-auto min-h-12 justify-start gap-3 py-3"
                disabled={!canPublish || busy}
              >
                <SendIcon aria-hidden="true" />
                <span className="text-left">
                  <span className="block font-semibold">
                    {firstTime ? "Publier les jumelages" : "Republier les changements"}
                  </span>
                  <span className="block text-xs font-normal opacity-90">
                    {overview.pending} courriel{overview.pending > 1 ? "s" : ""} à envoyer
                  </span>
                </span>
              </Button>
            }
          />
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {firstTime ? "Publier les jumelages?" : "Republier les changements?"}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {firstTime
                  ? `L'événement passera au statut « Jumelages publiés » et ${overview.pending} participant${overview.pending > 1 ? "s" : ""} recevront leurs jumelages et leur table par courriel (par lots de 20). Les inscriptions seront fermées.`
                  : `Seuls les ${overview.pending} participant${overview.pending > 1 ? "s" : ""} dont les jumelages ou la table ont changé recevront un courriel de mise à jour.`}
                {overview.noConsent
                  ? ` ${overview.noConsent} inscrit${overview.noConsent > 1 ? "s" : ""} sans consentement ne recevront rien.`
                  : ""}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction onClick={() => loop("publish", () => publishMatches(eventId))}>
                {firstTime ? "Publier et envoyer" : "Envoyer les mises à jour"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog>
          <AlertDialogTrigger
            render={
              <Button
                variant="outline"
                size="lg"
                className="al-group h-auto min-h-12 justify-start gap-3 py-3"
                disabled={!overview.publishedAt || busy}
              >
                <BellRingIcon aria-hidden="true" />
                <span className="text-left">
                  <span className="block font-semibold">Envoyer un rappel</span>
                  <span className="block text-xs font-normal text-muted-foreground">
                    {overview.daysUntilEvent > 1
                      ? `Dans ${overview.daysUntilEvent} jours`
                      : overview.daysUntilEvent === 1
                        ? "C'est demain"
                        : "Le jour même ou passé"}
                    {overview.reminderSentAt ? " · déjà envoyé" : ""}
                  </span>
                </span>
              </Button>
            }
          />
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Envoyer le rappel maintenant?</AlertDialogTitle>
              <AlertDialogDescription>
                Chaque participant ayant consenti recevra la date, le lieu, sa table et le lien vers
                ses jumelages. Idéal la veille de l'événement.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction onClick={() => loop("reminder", () => startReminderRun(eventId))}>
                Envoyer le rappel
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Button
          variant="outline"
          size="lg"
          className="al-group h-auto min-h-12 justify-start gap-3 py-3"
          disabled={overview.noConsent === 0 || busy}
          onClick={() => loop("consent")}
        >
          <ShieldCheckIcon aria-hidden="true" />
          <span className="text-left">
            <span className="block font-semibold">Demander les consentements</span>
            <span className="block text-xs font-normal text-muted-foreground">
              {overview.noConsent} inscrit{overview.noConsent > 1 ? "s" : ""} sans consentement
            </span>
          </span>
        </Button>
      </div>

      {run ? (
        <div className="space-y-2 rounded-lg border bg-card p-4" aria-live="polite">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="inline-flex items-center gap-2 font-medium">
              {run.done ? (
                <MailCheckIcon className="size-4 text-green-700" aria-hidden="true" />
              ) : null}
              <ActionSwap id={run.done ? "done" : "running"}>
                {run.done ? LABELS[run.kind].done : LABELS[run.kind].running}
              </ActionSwap>
            </span>
            <span className="text-muted-foreground tabular-nums">
              {run.sent + run.failed} / {run.total}
            </span>
          </div>
          <Progress
            value={run.total ? ((run.sent + run.failed) / run.total) * 100 : run.done ? 100 : 0}
          />
          {run.failed ? (
            <p className="text-sm text-destructive">
              {run.failed} échec{run.failed > 1 ? "s" : ""}. Vérifiez la configuration des
              courriels, puis relancez : seuls les courriels manquants repartiront.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
