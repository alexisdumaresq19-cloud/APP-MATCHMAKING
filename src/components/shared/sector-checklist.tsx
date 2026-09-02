"use client";

import { SparklesIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  id: string;
  /** Accessible name of the group (the visible label targets a div, which cannot be labelled). */
  label: string;
  /** Form field name: one checkbox per sector, read with formData.getAll(name). */
  name: string;
  sectors: { id: string; name: string }[];
  value: string[];
  onChange: (ids: string[]) => void;
  /** Sector ids pre-checked for the participant's own sector (from the affinity matrix). */
  suggested?: string[];
  /** The participant's own sector, shown last and never suggested. */
  ownSectorId?: string | null;
  invalid?: boolean;
  describedBy?: string;
  className?: string;
};

/**
 * "Avec qui aimeriez-vous collaborer ?" — a checklist of the organization's sectors. The parent
 * decides which ones are pre-checked (see `suggestedSectorsMap`); this component only renders and
 * offers a one-click return to the suggestions.
 */
export function SectorChecklist({
  id,
  label,
  name,
  sectors,
  value,
  onChange,
  suggested = [],
  ownSectorId,
  invalid,
  describedBy,
  className,
}: Props) {
  const suggestedSet = new Set(suggested);
  const selected = new Set(value);
  const ordered = [...sectors].sort((a, b) => {
    const rank = (s: { id: string }) => (suggestedSet.has(s.id) ? 0 : s.id === ownSectorId ? 2 : 1);
    return rank(a) - rank(b);
  });
  const differsFromSuggestions =
    suggested.length > 0 &&
    (suggested.length !== value.length || suggested.some((sid) => !selected.has(sid)));

  function toggle(sectorId: string, checked: boolean) {
    if (checked) onChange(selected.has(sectorId) ? value : [...value, sectorId]);
    else onChange(value.filter((sid) => sid !== sectorId));
  }

  return (
    <div
      id={id}
      role="group"
      aria-label={label}
      aria-describedby={describedBy}
      className={cn("space-y-3", className)}
    >
      {suggested.length ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-brand/30 bg-brand/5 px-3 py-2 text-sm">
          <p className="flex items-center gap-2">
            <SparklesIcon className="size-4 shrink-0 text-brand" aria-hidden="true" />
            <span>
              Nous avons pré-coché les secteurs qui collaborent le plus souvent avec le vôtre.
              Ajustez librement.
            </span>
          </p>
          {differsFromSuggestions ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8"
              onClick={() => onChange([...suggested])}
            >
              Revenir aux suggestions
            </Button>
          ) : null}
        </div>
      ) : null}
      <ul className="grid gap-2 sm:grid-cols-2">
        {ordered.map((sector) => {
          const checked = selected.has(sector.id);
          const isSuggested = suggestedSet.has(sector.id);
          const inputId = `${id}-${sector.id}`;
          return (
            <li key={sector.id}>
              <label
                htmlFor={inputId}
                className={cn(
                  "flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-base transition-colors",
                  checked
                    ? "border-brand bg-brand/10 font-medium"
                    : "border-border hover:bg-muted/60",
                  invalid && "border-destructive/60",
                )}
              >
                <input
                  id={inputId}
                  type="checkbox"
                  name={name}
                  value={sector.id}
                  checked={checked}
                  onChange={(event) => toggle(sector.id, event.target.checked)}
                  className="size-5 shrink-0 accent-[var(--brand-primary)]"
                />
                <span className="flex-1">{sector.name}</span>
                {isSuggested ? (
                  <span className="rounded-full bg-brand/15 px-2 py-0.5 text-xs font-medium text-brand">
                    Suggéré
                  </span>
                ) : sector.id === ownSectorId ? (
                  <span className="text-xs text-muted-foreground">Votre secteur</span>
                ) : null}
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
