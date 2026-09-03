import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { FeedbackForm } from "@/components/participant/feedback-form";
import { FormAlert } from "@/components/shared/form-field";
import { resolveParticipantAccess } from "@/lib/auth/participant-session";
import { formatDate } from "@/lib/dates";
import { listMatchesForFeedback } from "@/server/services/feedback";

export const metadata: Metadata = { title: "Mon bilan" };

/** « Avez-vous conclu une affaire? » after a completed event (P2-S3, D-38). */
export default async function EventFeedbackPage({
  params,
}: {
  params: Promise<{ token: string; eventId: string }>;
}) {
  const { token, eventId } = await params;
  const context = await resolveParticipantAccess(token);
  if (!context) notFound();
  const { participant, organization } = context;
  const data = await listMatchesForFeedback(participant.id, eventId);

  return (
    <div className="space-y-6">
      <Link
        href={`/p/${token}/evenements/${eventId}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" aria-hidden="true" />
        Retour à l&apos;événement
      </Link>
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Mon bilan</h1>
        {data ? (
          <p className="mt-1 text-base text-muted-foreground">
            {data.event.name} · {formatDate(data.event.startsAt, organization.timezone, "date")}.
            Pour chaque entreprise proposée, dites-nous ce qu&apos;il en est sorti. Vos réponses
            restent confidentielles.
          </p>
        ) : null}
      </div>
      {!data ? (
        <FormAlert
          variant="info"
          message="Le bilan s'ouvre une fois l'événement terminé par l'organisation."
        />
      ) : data.rows.length === 0 ? (
        <FormAlert variant="info" message="Aucun jumelage à évaluer pour cet événement." />
      ) : (
        <FeedbackForm token={token} eventId={eventId} rows={data.rows} />
      )}
    </div>
  );
}
