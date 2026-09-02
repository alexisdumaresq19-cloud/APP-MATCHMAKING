"use client";

import Link from "next/link";
import { useActionState, useTransition } from "react";
import { toast } from "sonner";
import { PlusIcon, StarIcon, Trash2Icon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FormAlert, fieldAria } from "@/components/shared/form-field";
import { SubmitButton } from "@/components/shared/submit-button";
import { RuleSetForm } from "./rule-set-form";
import {
  createRuleSet,
  deleteRuleSet,
  setDefaultRuleSet,
  updateRuleSet,
} from "@/server/actions/rules";
import type { ActionState } from "@/server/actions/types";
import type { RuleSetValues } from "@/lib/validation/matching";
import { cn } from "@/lib/utils";

type RuleSetRow = { id: string; name: string; isDefault: boolean; events: number };

export function RuleSetsManager({
  ruleSets,
  selected,
}: {
  ruleSets: RuleSetRow[];
  selected: { id: string; name: string; isDefault: boolean; values: RuleSetValues } | null;
}) {
  const [createState, createAction] = useActionState(createRuleSet, null);
  const [pending, startTransition] = useTransition();
  const errors = createState && !createState.ok ? (createState.fieldErrors ?? {}) : {};

  function run(fn: () => Promise<ActionState>) {
    startTransition(async () => {
      const result = await fn();
      if (result && !result.ok) toast.error(result.formError ?? "Une erreur est survenue.");
      else if (result?.ok && result.message) toast.success(result.message);
    });
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[300px_1fr]">
      <aside className="space-y-4">
        <ul className="divide-y rounded-lg border bg-card">
          {ruleSets.map((ruleSet) => (
            <li key={ruleSet.id}>
              <Link
                href={`/admin/settings/regles?jeu=${ruleSet.id}`}
                className={cn(
                  "flex items-center justify-between gap-2 px-3 py-3 hover:bg-muted/50",
                  selected?.id === ruleSet.id && "bg-muted/60",
                )}
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">{ruleSet.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {ruleSet.events} événement{ruleSet.events > 1 ? "s" : ""}
                  </span>
                </span>
                {ruleSet.isDefault ? <Badge>Par défaut</Badge> : null}
              </Link>
            </li>
          ))}
        </ul>
        <form action={createAction} noValidate className="space-y-3 rounded-lg border bg-card p-4">
          <h2 className="text-base font-semibold">Nouveau jeu de règles</h2>
          <FormAlert message={createState && !createState.ok ? createState.formError : null} />
          <Field label="Nom" htmlFor="rule-set-name" error={errors.name}>
            <Input
              id="rule-set-name"
              name="name"
              className="h-10 text-base"
              placeholder="Ex. : Déjeuners régionaux"
              {...fieldAria("rule-set-name", errors.name)}
            />
          </Field>
          <SubmitButton pendingLabel="Création…" className="w-full">
            <PlusIcon aria-hidden="true" />
            Créer
          </SubmitButton>
        </form>
      </aside>
      <section>
        {selected ? (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">{selected.name}</h2>
              <div className="flex gap-2">
                {!selected.isDefault ? (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={pending}
                    onClick={() => run(() => setDefaultRuleSet(selected.id))}
                  >
                    <StarIcon aria-hidden="true" />
                    Définir par défaut
                  </Button>
                ) : null}
                {!selected.isDefault ? (
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={pending}
                    onClick={() => run(() => deleteRuleSet(selected.id))}
                  >
                    <Trash2Icon aria-hidden="true" />
                    Supprimer
                  </Button>
                ) : null}
              </div>
            </div>
            <RuleSetForm
              key={selected.id}
              action={updateRuleSet.bind(null, selected.id)}
              initial={selected.values}
              note="Les pondérations s'appliquent aux événements qui utilisent ce jeu de règles (ou à tous si c'est le jeu par défaut). Relancez le matching pour voir l'effet."
            />
          </div>
        ) : (
          <p className="text-base text-muted-foreground">Créez un premier jeu de règles.</p>
        )}
      </section>
    </div>
  );
}
