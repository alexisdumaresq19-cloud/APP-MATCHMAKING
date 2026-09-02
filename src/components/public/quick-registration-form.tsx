"use client";

import { useActionState, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Field, FormAlert, fieldAria } from "@/components/shared/form-field";
import { SubmitButton } from "@/components/shared/submit-button";
import { ConsentBox } from "@/components/public/consent-box";
import type { ActionState } from "@/server/actions/types";

type Props = {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  needsConsent: boolean;
  consentText: string;
};

export function QuickRegistrationForm({ action, needsConsent, consentText }: Props) {
  const [state, formAction] = useActionState(action, null);
  const [goalsText, setGoalsText] = useState("");
  const [consent, setConsent] = useState(false);
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};

  return (
    <form action={formAction} className="space-y-5">
      <FormAlert message={state && !state.ok ? state.formError : null} />
      <Field
        label="Qu'espérez-vous retirer de cet événement?"
        htmlFor="goalsText"
        optionalLabel
        error={errors.goalsText}
      >
        <Textarea
          id="goalsText"
          name="goalsText"
          maxLength={500}
          rows={3}
          value={goalsText}
          onChange={(e) => setGoalsText(e.target.value)}
          className="text-base"
          {...fieldAria("goalsText", errors.goalsText)}
        />
      </Field>
      {needsConsent ? (
        <ConsentBox consentText={consentText} checked={consent} onChange={setConsent} error={errors.consent} />
      ) : null}
      <SubmitButton
        size="lg"
        className="w-full bg-brand text-brand-foreground hover:bg-brand/90 sm:w-auto"
        pendingLabel="Inscription en cours…"
      >
        Confirmer mon inscription
      </SubmitButton>
    </form>
  );
}
