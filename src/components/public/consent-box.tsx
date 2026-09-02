"use client";

import { AlertCircleIcon } from "lucide-react";
import { CheckMark } from "@/components/shared/check-mark";
import { paragraphs } from "@/lib/text";
import { cn } from "@/lib/utils";

type Props = {
  consentText: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  error?: string | string[];
  name?: string;
};

/** Law 25 notice, displayed in full, with an explicit (never pre-checked) consent checkbox. */
export function ConsentBox({ consentText, checked, onChange, error, name = "consent" }: Props) {
  const message = Array.isArray(error) ? error[0] : error;
  return (
    <section aria-labelledby="consent-title" className="space-y-3">
      <h3 id="consent-title" className="text-base font-semibold">
        Avis de confidentialité
      </h3>
      <div
        className="max-h-72 space-y-3 overflow-y-auto rounded-lg border bg-muted/40 p-4 text-sm leading-relaxed"
        tabIndex={0}
      >
        {paragraphs(consentText).map((p, index) => (
          <p key={index} className="whitespace-pre-line">
            {p}
          </p>
        ))}
      </div>
      <label
        htmlFor={name}
        className={cn(
          "flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-base",
          message ? "border-destructive" : "border-border",
        )}
      >
        <span className="relative mt-0.5 size-6 shrink-0">
          <input
            id={name}
            name={name}
            type="checkbox"
            checked={checked}
            onChange={(event) => onChange(event.target.checked)}
            className="peer size-6 cursor-pointer appearance-none rounded-md outline-none"
            aria-invalid={message ? true : undefined}
            aria-describedby={message ? `${name}-error` : undefined}
          />
          <CheckMark
            checked={checked}
            className="peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50"
          />
        </span>
        <span>
          J'ai lu cet avis et je consens à la collecte et à l'utilisation de mes renseignements aux
          fins décrites ci-dessus.
        </span>
      </label>
      {message ? (
        <p id={`${name}-error`} role="alert" className="flex items-start gap-1 text-sm text-destructive">
          <AlertCircleIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>{message}</span>
        </p>
      ) : null}
    </section>
  );
}
