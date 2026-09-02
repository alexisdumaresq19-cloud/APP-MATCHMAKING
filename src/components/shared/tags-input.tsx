"use client";

import { useId, useState, type KeyboardEvent } from "react";
import { PlusIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TAG_MAX_COUNT, TAG_MAX_LENGTH, cleanTag, normalizeTag } from "@/lib/normalize";
import { cn } from "@/lib/utils";

type Props = {
  name: string;
  id: string;
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  suggestions?: string[];
  invalid?: boolean;
  describedBy?: string;
};

/**
 * Chip-style tag editor. Tags are posted as repeated hidden inputs (`name` = one input per tag),
 * so the surrounding form works with plain FormData.
 */
export function TagsInput({
  name,
  id,
  value,
  onChange,
  placeholder,
  suggestions = [],
  invalid,
  describedBy,
}: Props) {
  const [draft, setDraft] = useState("");
  const listId = useId();
  const full = value.length >= TAG_MAX_COUNT;

  function add(raw: string) {
    const display = cleanTag(raw);
    const key = normalizeTag(display);
    if (!key || full) return;
    if (value.some((tag) => normalizeTag(tag) === key)) {
      setDraft("");
      return;
    }
    onChange([...value, display]);
    setDraft("");
  }

  function remove(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      add(draft);
    } else if (event.key === "Backspace" && draft === "" && value.length > 0) {
      remove(value.length - 1);
    }
  }

  const filteredSuggestions = suggestions
    .filter((s) => !value.some((tag) => normalizeTag(tag) === normalizeTag(s)))
    .slice(0, 50);

  return (
    <div className="space-y-2">
      {value.map((tag) => (
        <input key={`${name}-${tag}`} type="hidden" name={name} value={tag} />
      ))}
      {value.length > 0 ? (
        <ul className="flex flex-wrap gap-2" aria-label="Éléments ajoutés">
          {value.map((tag, index) => (
            <li
              key={`${tag}-${index}`}
              className="flex items-center gap-1 rounded-full bg-brand/10 py-1 pr-1 pl-3 text-base text-foreground"
            >
              <span>{tag}</span>
              <button
                type="button"
                onClick={() => remove(index)}
                className="flex size-8 items-center justify-center rounded-full hover:bg-brand/20 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                aria-label={`Retirer ${tag}`}
              >
                <XIcon className="size-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex gap-2">
        <Input
          id={id}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => draft.trim() && add(draft)}
          placeholder={full ? `Maximum de ${TAG_MAX_COUNT} éléments atteint` : placeholder}
          maxLength={TAG_MAX_LENGTH}
          disabled={full}
          list={filteredSuggestions.length ? listId : undefined}
          autoComplete="off"
          enterKeyHint="enter"
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className={cn("h-11 text-base")}
        />
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="h-11 shrink-0 px-3"
          onClick={() => add(draft)}
          disabled={full || !draft.trim()}
          aria-label="Ajouter l'élément"
        >
          <PlusIcon aria-hidden="true" />
          Ajouter
        </Button>
      </div>
      {filteredSuggestions.length ? (
        <datalist id={listId}>
          {filteredSuggestions.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      ) : null}
      <p className="text-sm text-muted-foreground">
        Appuyez sur Entrée ou sur « Ajouter » après chaque élément ({value.length}/{TAG_MAX_COUNT}).
      </p>
    </div>
  );
}
