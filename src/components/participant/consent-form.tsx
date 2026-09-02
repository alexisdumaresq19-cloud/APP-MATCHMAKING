"use client";

import { useActionState, useState } from "react";
import { FormAlert } from "@/components/shared/form-field";
import { SubmitButton } from "@/components/shared/submit-button";
import { ConsentBox } from "@/components/public/consent-box";
import type { ActionState } from "@/server/actions/types";

export function ConsentForm({
  action,
  consentText,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  consentText: string;
}) {
  const [state, formAction] = useActionState(action, null);
  const [checked, setChecked] = useState(false);
  if (state?.ok) return <FormAlert variant="success" message={state.message} />;
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  return (
    <form action={formAction} className="space-y-4">
      <FormAlert message={state && !state.ok ? state.formError : null} />
      <ConsentBox
        consentText={consentText}
        checked={checked}
        onChange={setChecked}
        error={errors.consent}
      />
      <SubmitButton
        size="lg"
        className="w-full bg-brand text-brand-foreground hover:bg-brand/90 sm:w-auto"
        pendingLabel="Enregistrement…"
      >
        Confirmer mon consentement
      </SubmitButton>
    </form>
  );
}
