"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Field, FormAlert, fieldAria } from "@/components/shared/form-field";
import { SubmitButton } from "@/components/shared/submit-button";
import { loginWithPassword, requestMagicLink } from "@/server/actions/auth";

export function LoginForm({
  callbackUrl,
  magicLinkAvailable = true,
}: {
  callbackUrl?: string;
  magicLinkAvailable?: boolean;
}) {
  const [state, formAction] = useActionState(loginWithPassword, null);
  const [magicState, magicAction] = useActionState(requestMagicLink, null);
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  const magicErrors = magicState && !magicState.ok ? (magicState.fieldErrors ?? {}) : {};

  return (
    <div className="space-y-6">
      <form action={formAction} noValidate className="space-y-4">
        <input type="hidden" name="callbackUrl" value={callbackUrl ?? ""} />
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
        <Field label="Mot de passe" htmlFor="password" error={errors.password}>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            className="h-11 text-base"
            {...fieldAria("password", errors.password)}
          />
        </Field>
        <SubmitButton size="lg" className="w-full" pendingLabel="Connexion…">
          Se connecter
        </SubmitButton>
        <p className="text-center text-sm">
          <Link
            href="/admin/mot-de-passe-oublie"
            className="text-muted-foreground underline-offset-4 hover:underline"
          >
            Mot de passe oublié?
          </Link>
        </p>
      </form>

      {magicLinkAvailable ? (
        <>
          <div className="flex items-center gap-3">
            <Separator className="flex-1" />
            <span className="text-xs text-muted-foreground uppercase">ou</span>
            <Separator className="flex-1" />
          </div>

          <form action={magicAction} noValidate className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Recevez un lien de connexion par courriel, sans mot de passe.
            </p>
            {magicState?.ok ? (
              <FormAlert variant="success" message={magicState.message} />
            ) : (
              <>
                <FormAlert message={magicState && !magicState.ok ? magicState.formError : null} />
                <Field label="Courriel" htmlFor="magic-email" error={magicErrors.email}>
                  <Input
                    id="magic-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    inputMode="email"
                    className="h-11 text-base"
                    {...fieldAria("magic-email", magicErrors.email)}
                  />
                </Field>
                <SubmitButton variant="outline" size="lg" className="w-full" pendingLabel="Envoi…">
                  Recevoir un lien de connexion
                </SubmitButton>
              </>
            )}
          </form>
        </>
      ) : null}
    </div>
  );
}
