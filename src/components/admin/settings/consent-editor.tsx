"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { HistoryIcon, RotateCcwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FormAlert, fieldAria } from "@/components/shared/form-field";
import { SubmitButton } from "@/components/shared/submit-button";
import { restoreConsentVersion, saveConsentText } from "@/server/actions/consent";
import { cn } from "@/lib/utils";

export type ConsentVersionView = {
  id: string;
  version: string;
  text: string;
  note: string | null;
  createdAtLabel: string;
  authorName: string | null;
  acceptedCount: number;
  isCurrent: boolean;
};

/** Editor of the Law 25 notice with its version history (S4-02). */
export function ConsentEditor({
  currentText,
  versions,
  readOnly,
  participantsToReconsent,
}: {
  currentText: string;
  versions: ConsentVersionView[];
  readOnly: boolean;
  participantsToReconsent: number;
}) {
  const [state, formAction] = useActionState(saveConsentText, null);
  const [text, setText] = useState(currentText);
  const [pending, startTransition] = useTransition();
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  useEffect(() => {
    if (state?.ok) toast.success(state.message ?? "Enregistré.");
  }, [state]);
  useEffect(() => setText(currentText), [currentText]);
  const dirty = text.trim() !== currentText.trim();

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <form action={formAction} noValidate className="space-y-4">
        <FormAlert message={state && !state.ok ? state.formError : null} />
        {readOnly ? (
          <FormAlert variant="info" message="Seul un propriétaire peut modifier l'avis." />
        ) : null}
        <Field
          label="Avis de collecte de renseignements personnels"
          htmlFor="text"
          required
          error={errors.text}
          hint={`${text.length} caractères. Affiché intégralement à l'inscription; chaque acceptation est journalisée avec la version du texte.`}
        >
          <Textarea
            id="text"
            name="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={18}
            readOnly={readOnly}
            className="text-base leading-relaxed"
            {...fieldAria("text", errors.text, "hint")}
          />
        </Field>
        {!readOnly ? (
          <>
            <Field
              label="Note pour l'historique"
              htmlFor="note"
              optionalLabel
              error={errors.note}
              hint="Ex. : « Ajout de la durée de conservation »."
            >
              <Input
                id="note"
                name="note"
                maxLength={200}
                className="h-10 text-base"
                {...fieldAria("note", errors.note, "hint")}
              />
            </Field>
            {dirty ? (
              <FormAlert
                variant="info"
                message={`En adoptant ce texte, ${participantsToReconsent} participant${participantsToReconsent > 1 ? "s" : ""} devront l'accepter de nouveau avant d'être jumelés (demande envoyée depuis l'onglet Publication).`}
              />
            ) : null}
            <div className="flex flex-wrap gap-2">
              <SubmitButton size="lg" pendingLabel="Adoption…" disabled={!dirty}>
                Adopter cette version
              </SubmitButton>
              {dirty ? (
                <Button type="button" variant="ghost" onClick={() => setText(currentText)}>
                  Annuler les modifications
                </Button>
              ) : null}
            </div>
          </>
        ) : null}
      </form>

      <aside className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <HistoryIcon className="size-5" aria-hidden="true" />
          Historique des versions
        </h2>
        <ol className="space-y-2">
          {versions.map((version) => (
            <li
              key={version.id}
              className={cn(
                "rounded-lg border p-3 text-sm",
                version.isCurrent && "border-brand bg-brand/5",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium">
                    {version.isCurrent ? "Version en vigueur" : "Version antérieure"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {version.createdAtLabel}
                    {version.authorName ? ` · ${version.authorName}` : ""}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs tabular-nums">
                  {version.acceptedCount} acceptation{version.acceptedCount > 1 ? "s" : ""}
                </span>
              </div>
              {version.note ? <p className="mt-1 text-muted-foreground">{version.note}</p> : null}
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{version.text}</p>
              <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                {version.version.slice(0, 12)}…
              </p>
              {!version.isCurrent && !readOnly && version.id !== "current" ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      const result = await restoreConsentVersion(version.id);
                      if (result && !result.ok)
                        toast.error(result.formError ?? "Une erreur est survenue.");
                      else toast.success(result?.message ?? "Version restaurée.");
                    })
                  }
                >
                  <RotateCcwIcon aria-hidden="true" />
                  Restaurer
                </Button>
              ) : null}
            </li>
          ))}
        </ol>
      </aside>
    </div>
  );
}
