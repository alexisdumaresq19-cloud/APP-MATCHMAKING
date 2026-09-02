"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FormAlert, fieldAria } from "@/components/shared/form-field";
import { NativeSelect } from "@/components/shared/native-select";
import { SubmitButton } from "@/components/shared/submit-button";
import { toLocalInput } from "@/lib/dates";
import { slugify } from "@/lib/normalize";
import type { ActionState } from "@/server/actions/types";

export type EventFormInitial = {
  name: string;
  slug: string;
  description: string | null;
  startsAt: Date;
  endsAt: Date | null;
  venueName: string | null;
  venueAddress: string | null;
  ticketUrl: string | null;
  capacity: number | null;
  registrationOpensAt: Date | null;
  registrationClosesAt: Date | null;
  tableCount: number;
  seatsPerTable: number;
  roundCount: number;
  roundMinutes: number | null;
  matchesPerParticipant: number;
  matchingRuleSetId: string | null;
};

type Props = {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  initial?: EventFormInitial;
  ruleSets: { id: string; name: string; isDefault: boolean }[];
  timezone: string;
};

export function EventForm({ action, initial, ruleSets, timezone }: Props) {
  const [state, formAction] = useActionState(action, null);
  const [name, setName] = useState(initial?.name ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(initial));
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};

  useEffect(() => {
    if (state?.ok) toast.success(state.message ?? "Enregistré.");
  }, [state]);

  function onNameChange(value: string) {
    setName(value);
    if (!slugTouched) setSlug(slugify(value));
  }

  const inputClass = "h-11 text-base";

  return (
    <form action={formAction} noValidate className="space-y-8">
      <FormAlert message={state && !state.ok ? state.formError : null} />

      <section className="grid gap-5 md:grid-cols-2">
        <h2 className="text-lg font-semibold md:col-span-2">Informations</h2>
        <Field
          label="Nom de l'événement"
          htmlFor="name"
          required
          error={errors.name}
          className="md:col-span-2"
        >
          <Input
            id="name"
            name="name"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            className={inputClass}
            {...fieldAria("name", errors.name)}
          />
        </Field>
        <Field
          label="Lien public"
          htmlFor="slug"
          required
          error={errors.slug}
          hint="Lettres minuscules, chiffres et tirets. Généré à partir du nom."
          className="md:col-span-2"
        >
          <Input
            id="slug"
            name="slug"
            value={slug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(e.target.value);
            }}
            className={`${inputClass} font-mono`}
            {...fieldAria("slug", errors.slug, "hint")}
          />
        </Field>
        <Field
          label="Description"
          htmlFor="description"
          optionalLabel
          error={errors.description}
          hint="Affichée sur la page publique. Séparez les paragraphes par une ligne vide."
          className="md:col-span-2"
        >
          <Textarea
            id="description"
            name="description"
            rows={5}
            defaultValue={initial?.description ?? ""}
            className="text-base"
            {...fieldAria("description", errors.description, "hint")}
          />
        </Field>
        <Field
          label="Début"
          htmlFor="startsAt"
          required
          error={errors.startsAt}
          hint={`Heure locale (${timezone}).`}
        >
          <Input
            id="startsAt"
            name="startsAt"
            type="datetime-local"
            defaultValue={initial ? toLocalInput(initial.startsAt, timezone) : ""}
            className={inputClass}
            {...fieldAria("startsAt", errors.startsAt, "hint")}
          />
        </Field>
        <Field label="Fin" htmlFor="endsAt" optionalLabel error={errors.endsAt}>
          <Input
            id="endsAt"
            name="endsAt"
            type="datetime-local"
            defaultValue={initial ? toLocalInput(initial.endsAt, timezone) : ""}
            className={inputClass}
            {...fieldAria("endsAt", errors.endsAt)}
          />
        </Field>
        <Field label="Lieu" htmlFor="venueName" optionalLabel error={errors.venueName}>
          <Input
            id="venueName"
            name="venueName"
            defaultValue={initial?.venueName ?? ""}
            className={inputClass}
            {...fieldAria("venueName", errors.venueName)}
          />
        </Field>
        <Field label="Adresse" htmlFor="venueAddress" optionalLabel error={errors.venueAddress}>
          <Input
            id="venueAddress"
            name="venueAddress"
            defaultValue={initial?.venueAddress ?? ""}
            className={inputClass}
            {...fieldAria("venueAddress", errors.venueAddress)}
          />
        </Field>
        <Field
          label="Lien de billetterie"
          htmlFor="ticketUrl"
          optionalLabel
          error={errors.ticketUrl}
          hint="Eventbrite, Zeffy, Le Point de vente… Un bouton « Acheter mon billet » s'affiche sur la page publique et dans l'espace participant."
        >
          <Input
            id="ticketUrl"
            name="ticketUrl"
            type="url"
            inputMode="url"
            placeholder="https://"
            defaultValue={initial?.ticketUrl ?? ""}
            className={inputClass}
            {...fieldAria("ticketUrl", errors.ticketUrl, "hint")}
          />
        </Field>
      </section>

      <section className="grid gap-5 md:grid-cols-3">
        <h2 className="text-lg font-semibold md:col-span-3">Inscriptions</h2>
        <Field
          label="Capacité"
          htmlFor="capacity"
          optionalLabel
          error={errors.capacity}
          hint="Vide = illimitée."
        >
          <Input
            id="capacity"
            name="capacity"
            type="number"
            min={1}
            inputMode="numeric"
            defaultValue={initial?.capacity ?? ""}
            className={inputClass}
            {...fieldAria("capacity", errors.capacity, "hint")}
          />
        </Field>
        <Field
          label="Ouverture des inscriptions"
          htmlFor="registrationOpensAt"
          optionalLabel
          error={errors.registrationOpensAt}
        >
          <Input
            id="registrationOpensAt"
            name="registrationOpensAt"
            type="datetime-local"
            defaultValue={initial ? toLocalInput(initial.registrationOpensAt, timezone) : ""}
            className={inputClass}
            {...fieldAria("registrationOpensAt", errors.registrationOpensAt)}
          />
        </Field>
        <Field
          label="Fermeture des inscriptions"
          htmlFor="registrationClosesAt"
          optionalLabel
          error={errors.registrationClosesAt}
        >
          <Input
            id="registrationClosesAt"
            name="registrationClosesAt"
            type="datetime-local"
            defaultValue={initial ? toLocalInput(initial.registrationClosesAt, timezone) : ""}
            className={inputClass}
            {...fieldAria("registrationClosesAt", errors.registrationClosesAt)}
          />
        </Field>
      </section>

      <section className="grid gap-5 md:grid-cols-3">
        <h2 className="text-lg font-semibold md:col-span-3">Tables et jumelage</h2>
        <Field label="Nombre de tables" htmlFor="tableCount" required error={errors.tableCount}>
          <Input
            id="tableCount"
            name="tableCount"
            type="number"
            min={1}
            max={200}
            inputMode="numeric"
            defaultValue={initial?.tableCount ?? 10}
            className={inputClass}
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
            min={2}
            max={50}
            inputMode="numeric"
            defaultValue={initial?.seatsPerTable ?? 6}
            className={inputClass}
            {...fieldAria("seatsPerTable", errors.seatsPerTable)}
          />
        </Field>
        <Field
          label="Nombre de rondes"
          htmlFor="roundCount"
          required
          error={errors.roundCount}
          hint="1 = placement fixe; plus = rondes de rencontre."
        >
          <Input
            id="roundCount"
            name="roundCount"
            type="number"
            min={1}
            max={10}
            inputMode="numeric"
            defaultValue={initial?.roundCount ?? 1}
            className={inputClass}
            {...fieldAria("roundCount", errors.roundCount, "hint")}
          />
        </Field>
        <Field
          label="Durée d'une ronde (minutes)"
          htmlFor="roundMinutes"
          optionalLabel
          error={errors.roundMinutes}
        >
          <Input
            id="roundMinutes"
            name="roundMinutes"
            type="number"
            min={5}
            max={240}
            inputMode="numeric"
            defaultValue={initial?.roundMinutes ?? 20}
            className={inputClass}
            {...fieldAria("roundMinutes", errors.roundMinutes)}
          />
        </Field>
        <Field
          label="Jumelages par participant"
          htmlFor="matchesPerParticipant"
          required
          error={errors.matchesPerParticipant}
          hint="Objectif minimal visé."
        >
          <Input
            id="matchesPerParticipant"
            name="matchesPerParticipant"
            type="number"
            min={1}
            max={20}
            inputMode="numeric"
            defaultValue={initial?.matchesPerParticipant ?? 5}
            className={inputClass}
            {...fieldAria("matchesPerParticipant", errors.matchesPerParticipant, "hint")}
          />
        </Field>
        <Field
          label="Jeu de règles de matching"
          htmlFor="matchingRuleSetId"
          optionalLabel
          error={errors.matchingRuleSetId}
        >
          <NativeSelect
            id="matchingRuleSetId"
            name="matchingRuleSetId"
            defaultValue={initial?.matchingRuleSetId ?? ""}
            {...fieldAria("matchingRuleSetId", errors.matchingRuleSetId)}
          >
            <option value="">Règles par défaut de l'organisation</option>
            {ruleSets.map((ruleSet) => (
              <option key={ruleSet.id} value={ruleSet.id}>
                {ruleSet.name}
                {ruleSet.isDefault ? " (par défaut)" : ""}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </section>

      <SubmitButton size="lg" pendingLabel="Enregistrement…">
        {initial ? "Enregistrer les modifications" : "Créer l'événement"}
      </SubmitButton>
    </form>
  );
}
