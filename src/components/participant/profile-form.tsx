"use client";

import { useActionState, useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FormAlert, fieldAria } from "@/components/shared/form-field";
import { NativeSelect } from "@/components/shared/native-select";
import { SectorChecklist } from "@/components/shared/sector-checklist";
import { SubmitButton } from "@/components/shared/submit-button";
import { TagsInput } from "@/components/shared/tags-input";
import { formatPhone } from "@/lib/normalize";
import type { ActionState } from "@/server/actions/types";

export type ProfileFormValues = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  jobTitle: string | null;
  companyName: string;
  sectorId: string | null;
  region: string | null;
  city: string | null;
  website: string | null;
  description: string | null;
  offers: string[];
  needs: string[];
  soughtSectorIds: string[];
};

type Props = {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  initial: ProfileFormValues;
  sectors: { id: string; name: string }[];
  regions: readonly string[];
  tagSuggestions?: string[];
  /** sectorId → sector ids pre-checked in "Avec qui aimeriez-vous collaborer ?". */
  suggestedSectors?: Record<string, string[]>;
  /** Prefix for element ids when several forms share a page (admin drawer). */
  idPrefix?: string;
  /** Extra fields rendered before the submit button (e.g. organizer notes). */
  extraFields?: ReactNode;
  submitClassName?: string;
  onSaved?: () => void;
};

export function ProfileForm({
  action,
  initial,
  sectors,
  regions,
  tagSuggestions = [],
  suggestedSectors = {},
  idPrefix = "",
  extraFields,
  submitClassName,
  onSaved,
}: Props) {
  const [state, formAction] = useActionState(action, null);
  const [offers, setOffers] = useState(initial.offers);
  const [needs, setNeeds] = useState(initial.needs);
  const [sectorId, setSectorId] = useState(initial.sectorId ?? "");
  const [soughtSectorIds, setSoughtSectorIds] = useState(initial.soughtSectorIds);
  const [description, setDescription] = useState(initial.description ?? "");
  const soughtId = `${idPrefix}soughtSectorIds`;
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};

  useEffect(() => {
    if (state?.ok) {
      toast.success(state.message ?? "Enregistré.");
      onSaved?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form action={formAction} noValidate className="space-y-6">
      <FormAlert message={state && !state.ok ? state.formError : null} />

      <section className="space-y-5">
        <h2 className="text-lg font-semibold">Vous</h2>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Prénom" htmlFor="firstName" required error={errors.firstName}>
            <Input
              id="firstName"
              name="firstName"
              defaultValue={initial.firstName}
              autoComplete="given-name"
              className="h-11 text-base"
              {...fieldAria("firstName", errors.firstName)}
            />
          </Field>
          <Field label="Nom" htmlFor="lastName" required error={errors.lastName}>
            <Input
              id="lastName"
              name="lastName"
              defaultValue={initial.lastName}
              autoComplete="family-name"
              className="h-11 text-base"
              {...fieldAria("lastName", errors.lastName)}
            />
          </Field>
        </div>
        <Field
          label="Courriel"
          htmlFor="email"
          hint="Le courriel ne peut pas être modifié. Écrivez-nous si nécessaire."
        >
          <Input
            id="email"
            value={initial.email}
            readOnly
            disabled
            className="h-11 text-base"
            aria-describedby="email-hint"
          />
        </Field>
        <Field label="Téléphone" htmlFor="phone" optionalLabel error={errors.phone}>
          <Input
            id="phone"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            defaultValue={formatPhone(initial.phone)}
            className="h-11 text-base"
            {...fieldAria("phone", errors.phone)}
          />
        </Field>
        <Field label="Titre ou fonction" htmlFor="jobTitle" optionalLabel error={errors.jobTitle}>
          <Input
            id="jobTitle"
            name="jobTitle"
            defaultValue={initial.jobTitle ?? ""}
            className="h-11 text-base"
            {...fieldAria("jobTitle", errors.jobTitle)}
          />
        </Field>
      </section>

      <section className="space-y-5">
        <h2 className="text-lg font-semibold">Votre entreprise</h2>
        <Field
          label="Nom de l'entreprise"
          htmlFor="companyName"
          required
          error={errors.companyName}
        >
          <Input
            id="companyName"
            name="companyName"
            defaultValue={initial.companyName}
            autoComplete="organization"
            className="h-11 text-base"
            {...fieldAria("companyName", errors.companyName)}
          />
        </Field>
        <Field label="Secteur d'activité" htmlFor="sectorId" required error={errors.sectorId}>
          <NativeSelect
            id="sectorId"
            name="sectorId"
            value={sectorId}
            onChange={(e) => {
              setSectorId(e.target.value);
              // An empty list follows the suggestions of the newly chosen sector.
              if (!soughtSectorIds.length)
                setSoughtSectorIds(suggestedSectors[e.target.value] ?? []);
            }}
            {...fieldAria("sectorId", errors.sectorId)}
          >
            <option value="">Choisissez un secteur…</option>
            {sectors.map((sector) => (
              <option key={sector.id} value={sector.id}>
                {sector.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Région" htmlFor="region" required error={errors.region}>
            <NativeSelect
              id="region"
              name="region"
              defaultValue={initial.region ?? ""}
              {...fieldAria("region", errors.region)}
            >
              <option value="">Choisissez une région…</option>
              {regions.map((region) => (
                <option key={region} value={region}>
                  {region}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Ville" htmlFor="city" required error={errors.city}>
            <Input
              id="city"
              name="city"
              defaultValue={initial.city ?? ""}
              autoComplete="address-level2"
              className="h-11 text-base"
              {...fieldAria("city", errors.city)}
            />
          </Field>
        </div>
        <Field label="Site web" htmlFor="website" optionalLabel error={errors.website}>
          <Input
            id="website"
            name="website"
            inputMode="url"
            defaultValue={initial.website ?? ""}
            className="h-11 text-base"
            {...fieldAria("website", errors.website)}
          />
        </Field>
        <Field
          label="Description courte"
          htmlFor="description"
          optionalLabel
          error={errors.description}
          hint={`${description.length}/300 caractères`}
        >
          <Textarea
            id="description"
            name="description"
            maxLength={300}
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="text-base"
            {...fieldAria("description", errors.description, "hint")}
          />
        </Field>
      </section>

      <section className="space-y-5">
        <h2 className="text-lg font-semibold">Votre jumelage</h2>
        <Field label="Ce que vous offrez" htmlFor="offers" required error={errors.offers}>
          <TagsInput
            id="offers"
            name="offers"
            value={offers}
            onChange={setOffers}
            suggestions={tagSuggestions}
            invalid={Boolean(errors.offers)}
          />
        </Field>
        <Field
          label="Avec qui aimeriez-vous collaborer?"
          htmlFor={soughtId}
          required
          error={errors.soughtSectorIds}
          hint="Les secteurs d'entreprises que vous souhaitez rencontrer."
        >
          <SectorChecklist
            id={soughtId}
            label="Avec qui aimeriez-vous collaborer?"
            name="soughtSectorIds"
            sectors={sectors}
            value={soughtSectorIds}
            onChange={setSoughtSectorIds}
            suggested={suggestedSectors[sectorId] ?? []}
            ownSectorId={sectorId || null}
            invalid={Boolean(errors.soughtSectorIds)}
            describedBy={errors.soughtSectorIds ? `${soughtId}-error` : `${soughtId}-hint`}
          />
        </Field>
        <Field label="Ce que vous cherchez" htmlFor="needs" optionalLabel error={errors.needs}>
          <TagsInput
            id="needs"
            name="needs"
            value={needs}
            onChange={setNeeds}
            suggestions={tagSuggestions}
            invalid={Boolean(errors.needs)}
          />
        </Field>
      </section>

      {extraFields}

      <SubmitButton
        size="lg"
        className={
          submitClassName ?? "w-full bg-brand text-brand-foreground hover:bg-brand/90 sm:w-auto"
        }
        pendingLabel="Enregistrement…"
      >
        Enregistrer
      </SubmitButton>
    </form>
  );
}
