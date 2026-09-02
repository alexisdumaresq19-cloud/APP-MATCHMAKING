"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { ChevronDownIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FormAlert, fieldAria } from "@/components/shared/form-field";
import { SubmitButton } from "@/components/shared/submit-button";
import { saveTableSetup } from "@/server/actions/tables";
import { cn } from "@/lib/utils";

type Props = {
  eventId: string;
  initial: {
    tableCount: number;
    seatsPerTable: number;
    roundCount: number;
    roundMinutes: number | null;
  };
  tables: { number: number; label: string | null }[];
  hasSeats: boolean;
  defaultOpen?: boolean;
};

export function TableSetupForm({ eventId, initial, tables, hasSeats, defaultOpen = false }: Props) {
  const [state, formAction] = useActionState(saveTableSetup.bind(null, eventId), null);
  const [open, setOpen] = useState(defaultOpen);
  const [tableCount, setTableCount] = useState(initial.tableCount);
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  useEffect(() => {
    if (state?.ok) toast.success(state.message ?? "Enregistré.");
  }, [state]);

  const numbers = Array.from({ length: Math.min(Math.max(tableCount, 1), 200) }, (_, i) => i + 1);
  const labelOf = (number: number) => tables.find((t) => t.number === number)?.label ?? "";

  return (
    <section className="rounded-lg border bg-card">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span>
          <span className="block text-base font-semibold">Configuration</span>
          <span className="block text-sm text-muted-foreground">
            {initial.tableCount} table{initial.tableCount > 1 ? "s" : ""} de {initial.seatsPerTable}{" "}
            places · {initial.roundCount} ronde{initial.roundCount > 1 ? "s" : ""}
            {initial.roundCount > 1 && initial.roundMinutes
              ? ` de ${initial.roundMinutes} min`
              : ""}
          </span>
        </span>
        <ChevronDownIcon
          className={cn("size-5 shrink-0 transition-transform", open && "rotate-180")}
          aria-hidden="true"
        />
      </button>
      {open ? (
        <form action={formAction} noValidate className="space-y-5 border-t px-4 py-4">
          <FormAlert message={state && !state.ok ? state.formError : null} />
          {hasSeats ? (
            <FormAlert
              variant="info"
              message="Des places sont déjà attribuées. Réduire le nombre de tables ou de rondes libère les places concernées."
            />
          ) : null}
          <div className="grid gap-4 sm:grid-cols-4">
            <Field label="Tables" htmlFor="tableCount" required error={errors.tableCount}>
              <Input
                id="tableCount"
                name="tableCount"
                type="number"
                inputMode="numeric"
                min={1}
                max={200}
                value={tableCount}
                onChange={(e) => setTableCount(Number(e.target.value) || 1)}
                className="h-10 text-base"
                {...fieldAria("tableCount", errors.tableCount)}
              />
            </Field>
            <Field
              label="Places par table"
              htmlFor="seatsPerTable"
              required
              error={errors.seatsPerTable}
            >
              <Input
                id="seatsPerTable"
                name="seatsPerTable"
                type="number"
                inputMode="numeric"
                min={2}
                max={50}
                defaultValue={initial.seatsPerTable}
                className="h-10 text-base"
                {...fieldAria("seatsPerTable", errors.seatsPerTable)}
              />
            </Field>
            <Field label="Rondes" htmlFor="roundCount" required error={errors.roundCount}>
              <Input
                id="roundCount"
                name="roundCount"
                type="number"
                inputMode="numeric"
                min={1}
                max={10}
                defaultValue={initial.roundCount}
                className="h-10 text-base"
                {...fieldAria("roundCount", errors.roundCount)}
              />
            </Field>
            <Field
              label="Minutes par ronde"
              htmlFor="roundMinutes"
              optionalLabel
              error={errors.roundMinutes}
            >
              <Input
                id="roundMinutes"
                name="roundMinutes"
                type="number"
                inputMode="numeric"
                min={5}
                max={240}
                defaultValue={initial.roundMinutes ?? ""}
                className="h-10 text-base"
                {...fieldAria("roundMinutes", errors.roundMinutes)}
              />
            </Field>
          </div>
          <fieldset className="space-y-2">
            <legend className="text-base font-medium">
              Noms des tables{" "}
              <span className="font-normal text-muted-foreground">(facultatif)</span>
            </legend>
            <p className="text-sm text-muted-foreground">
              Par exemple « Salon bleu » ou « Table des fournisseurs ». Vide = « Table 1 », « Table
              2 »…
            </p>
            <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {numbers.map((number) => (
                <label key={number} className="flex items-center gap-2 text-sm">
                  <span className="w-8 shrink-0 text-right text-muted-foreground tabular-nums">
                    {number}
                  </span>
                  <Input
                    name={`label-${number}`}
                    defaultValue={labelOf(number)}
                    maxLength={40}
                    placeholder={`Table ${number}`}
                    className="h-9"
                    aria-label={`Nom de la table ${number}`}
                  />
                </label>
              ))}
            </div>
          </fieldset>
          <div className="flex flex-wrap items-center gap-3">
            <SubmitButton pendingLabel="Enregistrement…">Enregistrer la configuration</SubmitButton>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Fermer
            </Button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
