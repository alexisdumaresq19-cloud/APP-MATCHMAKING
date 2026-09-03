"use client";

import { useActionState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { FormAlert } from "@/components/shared/form-field";
import { SubmitButton } from "@/components/shared/submit-button";
import { cn } from "@/lib/utils";
import { submitEventFeedback } from "@/server/actions/feedback";
import { OUTCOMES, OUTCOME_LABELS, type FeedbackMatchRow } from "@/lib/feedback";

export function FeedbackForm({
  token,
  eventId,
  rows,
}: {
  token: string;
  eventId: string;
  rows: FeedbackMatchRow[];
}) {
  const [state, formAction] = useActionState(submitEventFeedback.bind(null, token, eventId), null);
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};

  return (
    <form action={formAction} noValidate className="space-y-6">
      <FormAlert message={state && !state.ok ? state.formError : null} />
      {state?.ok ? <FormAlert variant="success" message={state.message ?? "Merci!"} /> : null}
      {rows.map((row) => {
        const name = `outcome-${row.matchId}`;
        const error = errors[name]?.[0];
        return (
          <fieldset key={row.matchId} className="space-y-3 rounded-lg border bg-card p-4">
            <legend className="px-1 text-base font-semibold">
              {row.partnerCompany}{" "}
              <span className="font-normal text-muted-foreground">· {row.partnerName}</span>
            </legend>
            <p className="text-sm text-muted-foreground">Qu&apos;en est-il sorti?</p>
            <ul className="grid gap-2 sm:grid-cols-2">
              {OUTCOMES.map((outcome) => {
                const id = `${name}-${outcome}`;
                return (
                  <li key={outcome}>
                    <label
                      htmlFor={id}
                      className={cn(
                        "flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm has-checked:border-brand has-checked:bg-brand/10 has-checked:font-medium",
                        error && "border-destructive/60",
                      )}
                    >
                      <input
                        id={id}
                        type="radio"
                        name={name}
                        value={outcome}
                        defaultChecked={row.outcome === outcome}
                        className="size-4 accent-[var(--brand)]"
                      />
                      {OUTCOME_LABELS[outcome]}
                    </label>
                  </li>
                );
              })}
            </ul>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <Textarea
              name={`comment-${row.matchId}`}
              aria-label={`Commentaire sur ${row.partnerCompany}`}
              placeholder="Un mot, si vous voulez (facultatif)."
              rows={2}
              maxLength={500}
              defaultValue={row.comment ?? ""}
              className="text-sm"
            />
          </fieldset>
        );
      })}
      <SubmitButton
        size="lg"
        className="bg-brand text-brand-foreground hover:bg-brand/90"
        pendingLabel="Enregistrement…"
      >
        Envoyer mon bilan
      </SubmitButton>
    </form>
  );
}
