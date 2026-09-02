"use client";

import { useActionState, useState, useTransition } from "react";
import { toast } from "sonner";
import { ArrowDownIcon, ArrowUpIcon, CheckIcon, PencilIcon, PlusIcon, XIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FormAlert, fieldAria } from "@/components/shared/form-field";
import { SubmitButton } from "@/components/shared/submit-button";
import { createSector, moveSector, renameSector, toggleSector } from "@/server/actions/sectors";
import type { ActionState } from "@/server/actions/types";

type SectorRow = { id: string; name: string; isActive: boolean; participants: number };

export function SectorsManager({ sectors }: { sectors: SectorRow[] }) {
  const [state, formAction] = useActionState(createSector, null);
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};

  function run(fn: () => Promise<ActionState>) {
    startTransition(async () => {
      const result = await fn();
      if (result && !result.ok) toast.error(result.formError ?? "Une erreur est survenue.");
      else if (result?.ok && result.message) toast.success(result.message);
    });
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
      <section>
        <h2 className="mb-3 text-lg font-semibold">Secteurs d'activité</h2>
        <p className="mb-4 text-base text-muted-foreground">
          Les participants choisissent leur secteur à l'inscription. Désactivez un secteur pour le
          retirer du formulaire sans perdre les participants qui l'ont choisi.
        </p>
        <ol className="divide-y rounded-lg border bg-card">
          {sectors.map((sector, index) => (
            <li key={sector.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
              <div className="flex shrink-0 flex-col">
                <button
                  type="button"
                  aria-label="Monter"
                  disabled={pending || index === 0}
                  onClick={() => run(() => moveSector(sector.id, "up"))}
                  className="flex size-7 items-center justify-center rounded hover:bg-muted disabled:opacity-30"
                >
                  <ArrowUpIcon className="size-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-label="Descendre"
                  disabled={pending || index === sectors.length - 1}
                  onClick={() => run(() => moveSector(sector.id, "down"))}
                  className="flex size-7 items-center justify-center rounded hover:bg-muted disabled:opacity-30"
                >
                  <ArrowDownIcon className="size-4" aria-hidden="true" />
                </button>
              </div>
              {editing?.id === sector.id ? (
                <form
                  className="flex min-w-0 flex-1 items-center gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const name = editing.name;
                    run(async () => {
                      const result = await renameSector(sector.id, name);
                      if (result?.ok) setEditing(null);
                      return result;
                    });
                  }}
                >
                  <Input
                    value={editing.name}
                    onChange={(e) => setEditing({ id: sector.id, name: e.target.value })}
                    className="h-10 text-base"
                    aria-label="Nom du secteur"
                    autoFocus
                  />
                  <Button type="submit" size="icon" aria-label="Enregistrer" disabled={pending}>
                    <CheckIcon aria-hidden="true" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label="Annuler"
                    onClick={() => setEditing(null)}
                  >
                    <XIcon aria-hidden="true" />
                  </Button>
                </form>
              ) : (
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <span
                    className={
                      sector.isActive
                        ? "font-medium"
                        : "font-medium text-muted-foreground line-through"
                    }
                  >
                    {sector.name}
                  </span>
                  <Badge variant="secondary">
                    {sector.participants} participant{sector.participants > 1 ? "s" : ""}
                  </Badge>
                  {!sector.isActive ? <Badge variant="outline">Désactivé</Badge> : null}
                </div>
              )}
              <div className="flex shrink-0 gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditing({ id: sector.id, name: sector.name })}
                  disabled={pending}
                >
                  <PencilIcon aria-hidden="true" />
                  Renommer
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => run(() => toggleSector(sector.id, !sector.isActive))}
                  disabled={pending}
                >
                  {sector.isActive ? "Désactiver" : "Réactiver"}
                </Button>
              </div>
            </li>
          ))}
        </ol>
      </section>
      <aside>
        <form action={formAction} noValidate className="space-y-3 rounded-lg border bg-card p-4">
          <h2 className="text-base font-semibold">Ajouter un secteur</h2>
          <FormAlert message={state && !state.ok ? state.formError : null} />
          <Field label="Nom" htmlFor="new-sector" error={errors.name}>
            <Input
              id="new-sector"
              name="name"
              className="h-10 text-base"
              placeholder="Ex. : Agroalimentaire"
              {...fieldAria("new-sector", errors.name)}
            />
          </Field>
          <SubmitButton pendingLabel="Ajout…" className="w-full">
            <PlusIcon aria-hidden="true" />
            Ajouter
          </SubmitButton>
        </form>
      </aside>
    </div>
  );
}
