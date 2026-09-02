"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Field, FormAlert, fieldAria } from "@/components/shared/form-field";
import { NativeSelect } from "@/components/shared/native-select";
import { SubmitButton } from "@/components/shared/submit-button";
import { brandStyle, normalizeHexColor, DEFAULT_ACCENT, DEFAULT_PRIMARY } from "@/lib/brand";
import { TIMEZONES } from "@/lib/timezones";
import { saveOrganizationSettings } from "@/server/actions/organization";

export type OrganizationFormValues = {
  name: string;
  platformName: string;
  privacyEmail: string;
  replyToEmail: string;
  timezone: string;
  primaryColor: string;
  accentColor: string;
};

/** Name, platform name, emails, time zone and the two brand colors with a live preview (S4-01). */
export function OrganizationForm({
  initial,
  readOnly,
}: {
  initial: OrganizationFormValues;
  readOnly: boolean;
}) {
  const [state, formAction] = useActionState(saveOrganizationSettings, null);
  const [primary, setPrimary] = useState(initial.primaryColor);
  const [accent, setAccent] = useState(initial.accentColor);
  const [platformName, setPlatformName] = useState(initial.platformName);
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  useEffect(() => {
    if (state?.ok) toast.success(state.message ?? "Enregistré.");
  }, [state]);

  const preview = brandStyle({
    primaryColor: normalizeHexColor(primary, DEFAULT_PRIMARY),
    accentColor: normalizeHexColor(accent, DEFAULT_ACCENT),
  });

  return (
    <form action={formAction} noValidate className="space-y-6">
      <FormAlert message={state && !state.ok ? state.formError : null} />
      {readOnly ? (
        <FormAlert
          variant="info"
          message="Seul un propriétaire peut modifier ces réglages. Vous pouvez les consulter."
        />
      ) : null}
      <fieldset disabled={readOnly} className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Nom de l'organisation" htmlFor="name" required error={errors.name}>
            <Input
              id="name"
              name="name"
              defaultValue={initial.name}
              className="h-11 text-base"
              {...fieldAria("name", errors.name)}
            />
          </Field>
          <Field
            label="Nom de la plateforme"
            htmlFor="platformName"
            required
            error={errors.platformName}
            hint="Affiché aux participants (en-tête, courriels)."
          >
            <Input
              id="platformName"
              name="platformName"
              value={platformName}
              onChange={(e) => setPlatformName(e.target.value)}
              maxLength={40}
              className="h-11 text-base"
              {...fieldAria("platformName", errors.platformName, "hint")}
            />
          </Field>
          <Field
            label="Courriel du responsable de la confidentialité"
            htmlFor="privacyEmail"
            required
            error={errors.privacyEmail}
            hint="Reçoit les demandes de suppression (Loi 25)."
          >
            <Input
              id="privacyEmail"
              name="privacyEmail"
              type="email"
              defaultValue={initial.privacyEmail}
              className="h-11 text-base"
              {...fieldAria("privacyEmail", errors.privacyEmail, "hint")}
            />
          </Field>
          <Field
            label="Courriel de réponse"
            htmlFor="replyToEmail"
            required
            error={errors.replyToEmail}
            hint="Les participants qui répondent à un courriel écrivent ici."
          >
            <Input
              id="replyToEmail"
              name="replyToEmail"
              type="email"
              defaultValue={initial.replyToEmail}
              className="h-11 text-base"
              {...fieldAria("replyToEmail", errors.replyToEmail, "hint")}
            />
          </Field>
          <Field label="Fuseau horaire" htmlFor="timezone" required error={errors.timezone}>
            <NativeSelect
              id="timezone"
              name="timezone"
              defaultValue={initial.timezone}
              {...fieldAria("timezone", errors.timezone)}
            >
              {TIMEZONES.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label}
                </option>
              ))}
            </NativeSelect>
          </Field>
        </div>

        <div className="grid gap-5 sm:grid-cols-[1fr_1fr_2fr]">
          <Field
            label="Couleur principale"
            htmlFor="primaryColor"
            required
            error={errors.primaryColor}
          >
            <div className="flex items-center gap-2">
              <input
                type="color"
                aria-label="Choisir la couleur principale"
                value={normalizeHexColor(primary, DEFAULT_PRIMARY)}
                onChange={(e) => setPrimary(e.target.value.toUpperCase())}
                className="size-11 cursor-pointer rounded-md border bg-background p-1"
              />
              <Input
                id="primaryColor"
                name="primaryColor"
                value={primary}
                onChange={(e) => setPrimary(e.target.value)}
                maxLength={7}
                className="h-11 font-mono text-base uppercase"
                {...fieldAria("primaryColor", errors.primaryColor)}
              />
            </div>
          </Field>
          <Field label="Couleur d'accent" htmlFor="accentColor" required error={errors.accentColor}>
            <div className="flex items-center gap-2">
              <input
                type="color"
                aria-label="Choisir la couleur d'accent"
                value={normalizeHexColor(accent, DEFAULT_ACCENT)}
                onChange={(e) => setAccent(e.target.value.toUpperCase())}
                className="size-11 cursor-pointer rounded-md border bg-background p-1"
              />
              <Input
                id="accentColor"
                name="accentColor"
                value={accent}
                onChange={(e) => setAccent(e.target.value)}
                maxLength={7}
                className="h-11 font-mono text-base uppercase"
                {...fieldAria("accentColor", errors.accentColor)}
              />
            </div>
          </Field>
          <div className="space-y-1.5">
            <p className="text-base font-medium">Aperçu</p>
            <div style={preview} className="overflow-hidden rounded-lg border" aria-hidden="true">
              <div className="bg-brand px-4 py-3 text-brand-foreground">
                <p className="text-base leading-tight font-bold">{platformName || "Jumelage"}</p>
                <p className="text-xs opacity-90">{initial.name}</p>
              </div>
              <div className="flex items-center gap-2 bg-background p-3">
                <span className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-brand-foreground">
                  Confirmer mon inscription
                </span>
                <span className="rounded-full bg-brand-accent px-2 py-0.5 text-xs font-medium text-brand-accent-foreground">
                  Suggéré
                </span>
              </div>
            </div>
          </div>
        </div>
        {!readOnly ? (
          <SubmitButton size="lg" pendingLabel="Enregistrement…">
            Enregistrer l'organisation
          </SubmitButton>
        ) : null}
      </fieldset>
    </form>
  );
}
