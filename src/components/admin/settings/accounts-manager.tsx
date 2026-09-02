"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { MailIcon, ShieldCheckIcon, UserRoundPlusIcon, UserRoundXIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Field, FormAlert, fieldAria } from "@/components/shared/form-field";
import { NativeSelect } from "@/components/shared/native-select";
import { SubmitButton } from "@/components/shared/submit-button";
import { changeRole, invite, resendInvite, setActive } from "@/server/actions/accounts";
import type { ActionState } from "@/server/actions/types";
import { cn } from "@/lib/utils";

export type AccountView = {
  id: string;
  name: string;
  email: string;
  role: "OWNER" | "STAFF";
  isActive: boolean;
  invitationPending: boolean;
  isSelf: boolean;
  lastLoginLabel: string | null;
};

/** Team accounts (S4-03): list, invite, role, activation. Owners only. */
export function AccountsManager({
  accounts,
  readOnly,
}: {
  accounts: AccountView[];
  readOnly: boolean;
}) {
  const [pending, startTransition] = useTransition();

  function run(fn: () => Promise<ActionState>) {
    startTransition(async () => {
      const result = await fn();
      if (result && !result.ok) toast.error(result.formError ?? "Une erreur est survenue.");
      else toast.success(result?.message ?? "Fait.");
    });
  }

  return (
    <div className="space-y-4">
      {readOnly ? (
        <FormAlert
          variant="info"
          message="Seul un propriétaire peut inviter, désactiver ou changer le rôle d'un compte."
        />
      ) : (
        <div className="flex justify-end">
          <InviteSheet />
        </div>
      )}
      <ul className="divide-y rounded-lg border bg-card" aria-busy={pending || undefined}>
        {accounts.map((account) => (
          <li
            key={account.id}
            className={cn(
              "flex flex-wrap items-center gap-3 px-4 py-3",
              !account.isActive && "opacity-60",
            )}
          >
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 font-medium">
                {account.name}
                {account.isSelf ? (
                  <span className="text-xs text-muted-foreground">(vous)</span>
                ) : null}
                <Badge variant={account.role === "OWNER" ? "default" : "secondary"}>
                  {account.role === "OWNER" ? "Propriétaire" : "Équipe"}
                </Badge>
                {!account.isActive ? <Badge variant="outline">Désactivé</Badge> : null}
                {account.invitationPending && account.isActive ? (
                  <Badge className="bg-amber-100 text-amber-900">Invitation en attente</Badge>
                ) : null}
              </p>
              <p className="text-sm text-muted-foreground">
                {account.email}
                {account.lastLoginLabel ? ` · dernière connexion ${account.lastLoginLabel}` : ""}
              </p>
            </div>
            {!readOnly && !account.isSelf ? (
              <div className="flex flex-wrap items-center gap-2">
                {account.invitationPending && account.isActive ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={pending}
                    onClick={() => run(() => resendInvite(account.id))}
                  >
                    <MailIcon aria-hidden="true" />
                    Renvoyer l'invitation
                  </Button>
                ) : null}
                <NativeSelect
                  aria-label={`Rôle de ${account.name}`}
                  value={account.role}
                  disabled={pending || !account.isActive}
                  className="h-9 w-auto"
                  onChange={(e) =>
                    run(() => changeRole(account.id, e.target.value as "OWNER" | "STAFF"))
                  }
                >
                  <option value="OWNER">Propriétaire</option>
                  <option value="STAFF">Équipe</option>
                </NativeSelect>
                <Button
                  type="button"
                  variant={account.isActive ? "ghost" : "outline"}
                  size="sm"
                  disabled={pending}
                  onClick={() => run(() => setActive(account.id, !account.isActive))}
                >
                  {account.isActive ? (
                    <>
                      <UserRoundXIcon aria-hidden="true" />
                      Désactiver
                    </>
                  ) : (
                    <>
                      <ShieldCheckIcon aria-hidden="true" />
                      Réactiver
                    </>
                  )}
                </Button>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
      <p className="text-sm text-muted-foreground">
        Une personne désactivée est déconnectée partout immédiatement. Il doit toujours rester au
        moins un propriétaire actif, et personne ne peut se désactiver ni changer son propre rôle.
      </p>
    </div>
  );
}

function InviteSheet() {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(invite, null);
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  useEffect(() => {
    if (state?.ok) {
      toast.success(state.message ?? "Invitation envoyée.");
      setOpen(false);
    }
  }, [state]);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button size="lg">
            <UserRoundPlusIcon aria-hidden="true" />
            Inviter une personne
          </Button>
        }
      />
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Inviter une personne</SheetTitle>
          <SheetDescription>
            Elle recevra un courriel avec un lien valide 7 jours pour choisir son mot de passe.
          </SheetDescription>
        </SheetHeader>
        <form action={formAction} noValidate className="space-y-4 px-4 pb-6">
          <FormAlert message={state && !state.ok ? state.formError : null} />
          <Field label="Nom" htmlFor="invite-name" required error={errors.name}>
            <Input
              id="invite-name"
              name="name"
              className="h-11 text-base"
              {...fieldAria("invite-name", errors.name)}
            />
          </Field>
          <Field label="Courriel" htmlFor="invite-email" required error={errors.email}>
            <Input
              id="invite-email"
              name="email"
              type="email"
              inputMode="email"
              className="h-11 text-base"
              {...fieldAria("invite-email", errors.email)}
            />
          </Field>
          <Field
            label="Rôle"
            htmlFor="invite-role"
            required
            error={errors.role}
            hint="Équipe : gère les événements et les inscrits. Propriétaire : en plus, l'organisation, l'avis et les comptes."
          >
            <NativeSelect
              id="invite-role"
              name="role"
              defaultValue="STAFF"
              {...fieldAria("invite-role", errors.role, "hint")}
            >
              <option value="STAFF">Équipe</option>
              <option value="OWNER">Propriétaire</option>
            </NativeSelect>
          </Field>
          <SubmitButton size="lg" className="w-full" pendingLabel="Envoi…">
            Envoyer l'invitation
          </SubmitButton>
        </form>
      </SheetContent>
    </Sheet>
  );
}
