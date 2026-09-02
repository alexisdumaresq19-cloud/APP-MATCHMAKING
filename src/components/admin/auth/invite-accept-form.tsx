"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { Field, FormAlert, fieldAria } from "@/components/shared/form-field";
import { SubmitButton } from "@/components/shared/submit-button";
import { acceptInvitation } from "@/server/actions/auth";

export function InviteAcceptForm({ token }: { token: string }) {
  const [state, formAction] = useActionState(acceptInvitation, null);
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  return (
    <form action={formAction} noValidate className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <FormAlert message={state && !state.ok ? state.formError : null} />
      <Field
        label="Mot de passe"
        htmlFor="password"
        error={errors.password}
        hint="Au moins 10 caractères."
      >
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          className="h-11 text-base"
          {...fieldAria("password", errors.password, "hint")}
        />
      </Field>
      <Field label="Confirmer le mot de passe" htmlFor="confirm" error={errors.confirm}>
        <Input
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          className="h-11 text-base"
          {...fieldAria("confirm", errors.confirm)}
        />
      </Field>
      <SubmitButton size="lg" className="w-full" pendingLabel="Activation…">
        Activer mon compte
      </SubmitButton>
    </form>
  );
}
