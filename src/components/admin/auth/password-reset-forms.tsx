"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { Field, FormAlert, fieldAria } from "@/components/shared/form-field";
import { SubmitButton } from "@/components/shared/submit-button";
import { requestPasswordReset, resetPassword } from "@/server/actions/auth";

export function PasswordResetRequestForm() {
  const [state, formAction] = useActionState(requestPasswordReset, null);
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  if (state?.ok) {
    return (
      <div className="space-y-4">
        <FormAlert variant="success" message={state.message} />
        <Link
          href="/admin/login"
          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          Retour à la connexion
        </Link>
      </div>
    );
  }
  return (
    <form action={formAction} noValidate className="space-y-4">
      <FormAlert message={state && !state.ok ? state.formError : null} />
      <Field label="Courriel" htmlFor="email" error={errors.email}>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          className="h-11 text-base"
          {...fieldAria("email", errors.email)}
        />
      </Field>
      <SubmitButton size="lg" className="w-full" pendingLabel="Envoi…">
        Envoyer le lien
      </SubmitButton>
      <p className="text-center text-sm">
        <Link
          href="/admin/login"
          className="text-muted-foreground underline-offset-4 hover:underline"
        >
          Retour à la connexion
        </Link>
      </p>
    </form>
  );
}

export function PasswordResetForm({ token }: { token: string }) {
  const [state, formAction] = useActionState(resetPassword, null);
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  return (
    <form action={formAction} noValidate className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <FormAlert message={state && !state.ok ? state.formError : null} />
      <Field
        label="Nouveau mot de passe"
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
      <SubmitButton size="lg" className="w-full" pendingLabel="Enregistrement…">
        Enregistrer le mot de passe
      </SubmitButton>
    </form>
  );
}
