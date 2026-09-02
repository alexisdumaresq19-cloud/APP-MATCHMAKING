"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { ArrowLeftIcon, ArrowRightIcon, CheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FormAlert, fieldAria } from "@/components/shared/form-field";
import { NativeSelect } from "@/components/shared/native-select";
import { SubmitButton } from "@/components/shared/submit-button";
import { SectorChecklist } from "@/components/shared/sector-checklist";
import { TagsInput } from "@/components/shared/tags-input";
import { ConsentBox } from "@/components/public/consent-box";
import type { ActionState } from "@/server/actions/types";
import { fieldErrorsOf, type FieldErrors } from "@/lib/validation/common";
import {
  stepCompanySchema,
  stepMatchingSchema,
  stepPersonSchema,
} from "@/lib/validation/registration";
import { cn } from "@/lib/utils";

const STEPS = ["Vous", "Votre entreprise", "Votre jumelage"] as const;

type Values = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  jobTitle: string;
  companyName: string;
  sectorId: string;
  region: string;
  city: string;
  website: string;
  description: string;
  goalsText: string;
  consent: boolean;
};

const EMPTY: Values = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  jobTitle: "",
  companyName: "",
  sectorId: "",
  region: "",
  city: "",
  website: "",
  description: "",
  goalsText: "",
  consent: false,
};

type Props = {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  sectors: { id: string; name: string }[];
  regions: readonly string[];
  consentText: string;
  privacyEmail: string;
  organizationName: string;
  tagSuggestions?: string[];
  /** sectorId → sector ids pre-checked in "Avec qui aimeriez-vous collaborer ?". */
  suggestedSectors?: Record<string, string[]>;
};

export function RegistrationForm({
  action,
  sectors,
  regions,
  consentText,
  tagSuggestions = [],
  suggestedSectors = {},
}: Props) {
  const [state, formAction] = useActionState(action, null);
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<Values>(EMPTY);
  const [offers, setOffers] = useState<string[]>([]);
  const [needs, setNeeds] = useState<string[]>([]);
  const [soughtSectorIds, setSoughtSectorIds] = useState<string[]>([]);
  const [soughtTouched, setSoughtTouched] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [startedAt, setStartedAt] = useState(0);
  const topRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setStartedAt(Date.now());
  }, []);

  useEffect(() => {
    if (state && !state.ok) {
      setErrors(state.fieldErrors ?? {});
      if (state.step !== undefined) setStep(state.step);
      topRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
    }
  }, [state]);

  function set<K extends keyof Values>(field: K, value: Values[K]) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    // Pre-check the sectors that collaborate most with the chosen one (until edited by hand).
    if (field === "sectorId" && !soughtTouched) {
      setSoughtSectorIds(suggestedSectors[String(value)] ?? []);
    }
  }

  function validateStep(index: number): boolean {
    const result =
      index === 0
        ? stepPersonSchema.safeParse(values)
        : index === 1
          ? stepCompanySchema.safeParse(values)
          : stepMatchingSchema.safeParse({
              offers,
              needs,
              soughtSectorIds,
              goalsText: values.goalsText,
              consent: values.consent,
            });
    if (result.success) return true;
    const fieldErrors = fieldErrorsOf(result.error);
    setErrors((current) => ({ ...current, ...fieldErrors }));
    const first = Object.keys(fieldErrors)[0];
    if (first) document.getElementById(first)?.focus();
    return false;
  }

  function goTo(index: number) {
    setStep(index);
    topRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }

  function next() {
    if (validateStep(step)) goTo(step + 1);
  }

  const formError = state && !state.ok ? state.formError : null;

  return (
    <form
      action={formAction}
      noValidate
      onSubmit={(event) => {
        if (!validateStep(2)) event.preventDefault();
      }}
      className="space-y-6"
    >
      <div ref={topRef} className="scroll-mt-4" />
      <ol className="grid grid-cols-3 gap-2" aria-label="Étapes du formulaire">
        {STEPS.map((title, index) => {
          const done = index < step;
          const current = index === step;
          return (
            <li key={title} className="flex flex-col gap-1.5">
              <div
                className={cn(
                  "h-1.5 rounded-full",
                  current || done ? "bg-brand" : "bg-muted",
                )}
                aria-hidden="true"
              />
              <span
                className={cn("text-sm", current ? "font-semibold text-foreground" : "text-muted-foreground")}
                aria-current={current ? "step" : undefined}
              >
                {done ? <CheckIcon className="mr-1 inline size-3.5" aria-hidden="true" /> : `${index + 1}. `}
                {title}
              </span>
            </li>
          );
        })}
      </ol>

      <FormAlert message={formError} />

      {/* Anti-spam: honeypot field (hidden from humans) and form start time. */}
      <div className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden" aria-hidden="true">
        <label htmlFor="companyFax">Télécopieur</label>
        <input id="companyFax" name="companyFax" type="text" tabIndex={-1} autoComplete="off" />
      </div>
      <input type="hidden" name="formStartedAt" value={startedAt} />

      {/* Step 1 — Vous */}
      <fieldset hidden={step !== 0} className="space-y-5">
        <legend className="sr-only">Vos coordonnées</legend>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Prénom" htmlFor="firstName" required error={errors.firstName}>
            <Input
              id="firstName"
              name="firstName"
              autoComplete="given-name"
              value={values.firstName}
              onChange={(e) => set("firstName", e.target.value)}
              className="h-11 text-base"
              {...fieldAria("firstName", errors.firstName)}
            />
          </Field>
          <Field label="Nom" htmlFor="lastName" required error={errors.lastName}>
            <Input
              id="lastName"
              name="lastName"
              autoComplete="family-name"
              value={values.lastName}
              onChange={(e) => set("lastName", e.target.value)}
              className="h-11 text-base"
              {...fieldAria("lastName", errors.lastName)}
            />
          </Field>
        </div>
        <Field
          label="Courriel"
          htmlFor="email"
          required
          error={errors.email}
          hint="Votre lien personnel d'accès vous sera envoyé à cette adresse."
        >
          <Input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={values.email}
            onChange={(e) => set("email", e.target.value)}
            className="h-11 text-base"
            {...fieldAria("email", errors.email, "hint")}
          />
        </Field>
        <Field label="Téléphone" htmlFor="phone" optionalLabel error={errors.phone}>
          <Input
            id="phone"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="514 555-0199"
            value={values.phone}
            onChange={(e) => set("phone", e.target.value)}
            className="h-11 text-base"
            {...fieldAria("phone", errors.phone)}
          />
        </Field>
        <Field label="Titre ou fonction" htmlFor="jobTitle" optionalLabel error={errors.jobTitle}>
          <Input
            id="jobTitle"
            name="jobTitle"
            autoComplete="organization-title"
            placeholder="Ex. : propriétaire, directrice générale"
            value={values.jobTitle}
            onChange={(e) => set("jobTitle", e.target.value)}
            className="h-11 text-base"
            {...fieldAria("jobTitle", errors.jobTitle)}
          />
        </Field>
        <div className="flex justify-end">
          <Button type="button" size="lg" className="touch-target bg-brand text-brand-foreground hover:bg-brand/90" onClick={next}>
            Continuer
            <ArrowRightIcon aria-hidden="true" />
          </Button>
        </div>
      </fieldset>

      {/* Step 2 — Votre entreprise */}
      <fieldset hidden={step !== 1} className="space-y-5">
        <legend className="sr-only">Votre entreprise</legend>
        <Field label="Nom de l'entreprise" htmlFor="companyName" required error={errors.companyName}>
          <Input
            id="companyName"
            name="companyName"
            autoComplete="organization"
            value={values.companyName}
            onChange={(e) => set("companyName", e.target.value)}
            className="h-11 text-base"
            {...fieldAria("companyName", errors.companyName)}
          />
        </Field>
        <Field label="Secteur d'activité" htmlFor="sectorId" required error={errors.sectorId}>
          <NativeSelect
            id="sectorId"
            name="sectorId"
            value={values.sectorId}
            onChange={(e) => set("sectorId", e.target.value)}
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
              value={values.region}
              onChange={(e) => set("region", e.target.value)}
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
              autoComplete="address-level2"
              value={values.city}
              onChange={(e) => set("city", e.target.value)}
              className="h-11 text-base"
              {...fieldAria("city", errors.city)}
            />
          </Field>
        </div>
        <Field label="Site web" htmlFor="website" optionalLabel error={errors.website}>
          <Input
            id="website"
            name="website"
            type="text"
            inputMode="url"
            autoComplete="url"
            placeholder="monentreprise.com"
            value={values.website}
            onChange={(e) => set("website", e.target.value)}
            className="h-11 text-base"
            {...fieldAria("website", errors.website)}
          />
        </Field>
        <Field
          label="Description courte de votre entreprise"
          htmlFor="description"
          optionalLabel
          error={errors.description}
          hint={`${values.description.length}/300 caractères`}
        >
          <Textarea
            id="description"
            name="description"
            maxLength={300}
            rows={3}
            value={values.description}
            onChange={(e) => set("description", e.target.value)}
            className="text-base"
            {...fieldAria("description", errors.description, "hint")}
          />
        </Field>
        <div className="flex justify-between gap-3">
          <Button type="button" variant="ghost" size="lg" className="touch-target" onClick={() => goTo(0)}>
            <ArrowLeftIcon aria-hidden="true" />
            Retour
          </Button>
          <Button type="button" size="lg" className="touch-target bg-brand text-brand-foreground hover:bg-brand/90" onClick={next}>
            Continuer
            <ArrowRightIcon aria-hidden="true" />
          </Button>
        </div>
      </fieldset>

      {/* Step 3 — Votre jumelage */}
      <fieldset hidden={step !== 2} className="space-y-5">
        <legend className="sr-only">Votre jumelage</legend>
        <Field
          label="Ce que vous offrez"
          htmlFor="offers"
          required
          error={errors.offers}
          hint="Vos produits ou services, en quelques mots chacun. Ex. : entretien ménager, comptabilité, sites web."
        >
          <TagsInput
            id="offers"
            name="offers"
            value={offers}
            onChange={(tags) => {
              setOffers(tags);
              setErrors((current) => ({ ...current, offers: undefined }));
            }}
            placeholder="Ex. : entretien ménager"
            suggestions={tagSuggestions}
            invalid={Boolean(errors.offers)}
            describedBy={errors.offers ? "offers-error" : "offers-hint"}
          />
        </Field>
        <Field
          label="Avec qui aimeriez-vous collaborer?"
          htmlFor="soughtSectorIds"
          required
          error={errors.soughtSectorIds}
          hint="Cochez les secteurs d'entreprises que vous souhaitez rencontrer."
        >
          <SectorChecklist
            id="soughtSectorIds"
            label="Avec qui aimeriez-vous collaborer?"
            name="soughtSectorIds"
            sectors={sectors}
            value={soughtSectorIds}
            onChange={(ids) => {
              setSoughtTouched(true);
              setSoughtSectorIds(ids);
              setErrors((current) => ({ ...current, soughtSectorIds: undefined }));
            }}
            suggested={suggestedSectors[values.sectorId] ?? []}
            ownSectorId={values.sectorId || null}
            invalid={Boolean(errors.soughtSectorIds)}
            describedBy={errors.soughtSectorIds ? "soughtSectorIds-error" : "soughtSectorIds-hint"}
          />
        </Field>
        <Field
          label="Ce que vous cherchez"
          htmlFor="needs"
          optionalLabel
          error={errors.needs}
          hint="Précisez, si vous le souhaitez, les fournisseurs, partenaires ou clients recherchés."
        >
          <TagsInput
            id="needs"
            name="needs"
            value={needs}
            onChange={(tags) => {
              setNeeds(tags);
              setErrors((current) => ({ ...current, needs: undefined }));
            }}
            placeholder="Ex. : ressources éducatives"
            suggestions={tagSuggestions}
            invalid={Boolean(errors.needs)}
            describedBy={errors.needs ? "needs-error" : "needs-hint"}
          />
        </Field>
        <Field
          label="Qu'espérez-vous retirer de cet événement?"
          htmlFor="goalsText"
          optionalLabel
          error={errors.goalsText}
        >
          <Textarea
            id="goalsText"
            name="goalsText"
            maxLength={500}
            rows={3}
            value={values.goalsText}
            onChange={(e) => set("goalsText", e.target.value)}
            className="text-base"
            {...fieldAria("goalsText", errors.goalsText)}
          />
        </Field>

        <ConsentBox
          consentText={consentText}
          checked={values.consent}
          onChange={(checked) => set("consent", checked)}
          error={errors.consent}
        />

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
          <Button type="button" variant="ghost" size="lg" className="touch-target" onClick={() => goTo(1)}>
            <ArrowLeftIcon aria-hidden="true" />
            Retour
          </Button>
          <SubmitButton
            size="lg"
            className="bg-brand text-brand-foreground hover:bg-brand/90"
            pendingLabel="Inscription en cours…"
          >
            Confirmer mon inscription
          </SubmitButton>
        </div>
      </fieldset>
    </form>
  );
}
