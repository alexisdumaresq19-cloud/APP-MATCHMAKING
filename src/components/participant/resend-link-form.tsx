"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { Field, FormAlert, fieldAria } from "@/components/shared/form-field";
import { SubmitButton } from "@/components/shared/submit-button";
import { requestNewParticipantLink } from "@/server/actions/participant";

export function ResendLinkForm() {
  const [state, formAction] = useActionState(requestNewParticipantLink, null);
  if (state?.ok) return <FormAlert variant="success" message={state.message} />;
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  return (
    <form action={formAction} className="space-y-4" noValidate>
      <FormAlert message={state && !state.ok ? state.formError : null} />
      <Field label="Courriel" htmlFor="email" required error={errors.email}>
        <Input
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          className="h-11 text-base"
          {...fieldAria("email", errors.email)}
        />
      </Field>
      <SubmitButton size="lg" className="w-full" pendingLabel="Envoi en cours…">
        Recevoir un nouveau lien
      </SubmitButton>
    </form>
  );
}
