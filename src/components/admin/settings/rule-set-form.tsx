"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { FormAlert } from "@/components/shared/form-field";
import { SubmitButton } from "@/components/shared/submit-button";
import type { ActionState } from "@/server/actions/types";
import type { RuleSetValues } from "@/lib/validation/matching";

const FIELDS: {
  name: keyof Omit<RuleSetValues, "excludeSameCompany">;
  label: string;
  help: string;
}[] = [
  {
    name: "weightComplementarity",
    label: "Complémentarité offres / besoins",
    help: "Importance de la correspondance entre ce que l'un offre et ce que l'autre cherche.",
  },
  {
    name: "weightSectorAffinity",
    label: "Affinité des secteurs",
    help: "Importance de la complémentarité des secteurs, selon la matrice d'affinité.",
  },
  {
    name: "weightRegion",
    label: "Proximité géographique",
    help: "Importance d'être dans la même région ou dans des régions voisines.",
  },
  {
    name: "weightNovelty",
    label: "Nouveauté",
    help: "Favorise les personnes qui ne se sont jamais rencontrées à vos événements passés.",
  },
  {
    name: "penaltySameSector",
    label: "Pénalité même secteur",
    help: "Points retirés quand les deux sont du même secteur (concurrents). À 100, ils ne sont jamais jumelés.",
  },
  {
    name: "minScoreToPropose",
    label: "Score minimal",
    help: "Sous ce score, un jumelage n'est pas proposé (abaissé automatiquement pour ceux qui auraient moins de 2 jumelages).",
  },
];

export function RuleSetForm({
  action,
  initial,
  submitLabel = "Enregistrer les règles",
  note,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  initial: RuleSetValues;
  submitLabel?: string;
  note?: string;
}) {
  const [state, formAction] = useActionState(action, null);
  const [values, setValues] = useState<RuleSetValues>(initial);
  useEffect(() => setValues(initial), [initial]);
  useEffect(() => {
    if (state?.ok) toast.success(state.message ?? "Enregistré.");
  }, [state]);
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};

  return (
    <form action={formAction} className="space-y-5">
      <FormAlert message={state && !state.ok ? state.formError : null} />
      {FIELDS.map((field) => (
        <div key={field.name} className="space-y-1">
          <div className="flex items-center justify-between gap-3">
            <label htmlFor={field.name} className="text-base font-medium">
              {field.label}
            </label>
            <output
              className="w-12 rounded bg-muted px-2 py-0.5 text-center text-sm font-semibold tabular-nums"
              htmlFor={field.name}
            >
              {values[field.name]}
            </output>
          </div>
          <input
            id={field.name}
            name={field.name}
            type="range"
            min={0}
            max={100}
            step={5}
            value={values[field.name]}
            onChange={(e) => setValues((v) => ({ ...v, [field.name]: Number(e.target.value) }))}
            className="h-2 w-full cursor-pointer accent-primary"
            aria-describedby={`${field.name}-help`}
          />
          <p id={`${field.name}-help`} className="text-sm text-muted-foreground">
            {field.help}
          </p>
          {errors[field.name] ? (
            <p className="text-sm text-destructive">{errors[field.name]?.[0]}</p>
          ) : null}
        </div>
      ))}
      <label className="flex items-start gap-3 rounded-lg border p-3 text-base">
        <input
          type="checkbox"
          name="excludeSameCompany"
          checked={values.excludeSameCompany}
          onChange={(e) => setValues((v) => ({ ...v, excludeSameCompany: e.target.checked }))}
          className="mt-1 size-5 accent-primary"
        />
        <span>
          <span className="font-medium">
            Ne jamais jumeler deux personnes de la même entreprise
          </span>
          <span className="block text-sm text-muted-foreground">
            Basé sur le nom d'entreprise normalisé (Inc., Ltée… ignorés).
          </span>
        </span>
      </label>
      {note ? <p className="text-sm text-muted-foreground">{note}</p> : null}
      <SubmitButton pendingLabel="Enregistrement…">{submitLabel}</SubmitButton>
    </form>
  );
}
