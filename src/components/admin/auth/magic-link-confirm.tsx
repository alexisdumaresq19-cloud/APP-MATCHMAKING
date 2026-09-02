"use client";

import { useActionState } from "react";
import { FormAlert } from "@/components/shared/form-field";
import { SubmitButton } from "@/components/shared/submit-button";
import { loginWithMagicLink } from "@/server/actions/auth";

/** The link is consumed on POST (never on GET) so mail scanners cannot burn it. */
export function MagicLinkConfirm({ token }: { token: string }) {
  const [state, formAction] = useActionState(loginWithMagicLink, null);
  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <FormAlert message={state && !state.ok ? state.formError : null} />
      <SubmitButton size="lg" className="w-full" pendingLabel="Connexion…">
        Me connecter
      </SubmitButton>
    </form>
  );
}
