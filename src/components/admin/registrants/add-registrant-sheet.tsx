"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { UserPlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Field, FormAlert, fieldAria } from "@/components/shared/form-field";
import { NativeSelect } from "@/components/shared/native-select";
import { SubmitButton } from "@/components/shared/submit-button";
import { TagsInput } from "@/components/shared/tags-input";
import { addRegistrantManually } from "@/server/actions/registrations";

type Props = {
  eventId: string;
  sectors: { id: string; name: string }[];
  regions: readonly string[];
  tagSuggestions?: string[];
};

export function AddRegistrantSheet({ eventId, sectors, regions, tagSuggestions = [] }: Props) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(addRegistrantManually.bind(null, eventId), null);
  const [offers, setOffers] = useState<string[]>([]);
  const [needs, setNeeds] = useState<string[]>([]);
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};

  useEffect(() => {
    if (state?.ok) {
      toast.success(state.message ?? "Inscrit ajouté.");
      setOpen(false);
      setOffers([]);
      setNeeds([]);
    }
  }, [state]);

  const input = "h-10 text-base";
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button variant="outline" size="lg">
            <UserPlusIcon aria-hidden="true" />
            Ajouter un inscrit
          </Button>
        }
      />
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Ajouter un inscrit</SheetTitle>
          <SheetDescription>
            Inscription manuelle (source « Ajout manuel »). La personne recevra un courriel pour
            accepter l'avis de confidentialité; elle compte dans la facturation dès maintenant.
          </SheetDescription>
        </SheetHeader>
        <form action={formAction} noValidate className="space-y-5 px-4 pb-6">
          <FormAlert message={state && !state.ok ? state.formError : null} />
          <Field
            label="Courriel"
            htmlFor="add-email"
            required
            error={errors.email}
            hint="Si ce courriel existe déjà chez vous, le profil existant est réutilisé."
          >
            <Input
              id="add-email"
              name="email"
              type="email"
              className={input}
              {...fieldAria("add-email", errors.email, "hint")}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Prénom" htmlFor="add-firstName" required error={errors.firstName}>
              <Input
                id="add-firstName"
                name="firstName"
                className={input}
                {...fieldAria("add-firstName", errors.firstName)}
              />
            </Field>
            <Field label="Nom" htmlFor="add-lastName" required error={errors.lastName}>
              <Input
                id="add-lastName"
                name="lastName"
                className={input}
                {...fieldAria("add-lastName", errors.lastName)}
              />
            </Field>
            <Field label="Téléphone" htmlFor="add-phone" optionalLabel error={errors.phone}>
              <Input
                id="add-phone"
                name="phone"
                type="tel"
                className={input}
                {...fieldAria("add-phone", errors.phone)}
              />
            </Field>
            <Field label="Titre" htmlFor="add-jobTitle" optionalLabel error={errors.jobTitle}>
              <Input
                id="add-jobTitle"
                name="jobTitle"
                className={input}
                {...fieldAria("add-jobTitle", errors.jobTitle)}
              />
            </Field>
          </div>
          <Field label="Entreprise" htmlFor="add-companyName" required error={errors.companyName}>
            <Input
              id="add-companyName"
              name="companyName"
              className={input}
              {...fieldAria("add-companyName", errors.companyName)}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Secteur" htmlFor="add-sectorId" required error={errors.sectorId}>
              <NativeSelect
                id="add-sectorId"
                name="sectorId"
                defaultValue=""
                className="h-10"
                {...fieldAria("add-sectorId", errors.sectorId)}
              >
                <option value="">Choisir…</option>
                {sectors.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Région" htmlFor="add-region" required error={errors.region}>
              <NativeSelect
                id="add-region"
                name="region"
                defaultValue=""
                className="h-10"
                {...fieldAria("add-region", errors.region)}
              >
                <option value="">Choisir…</option>
                {regions.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Ville" htmlFor="add-city" required error={errors.city}>
              <Input
                id="add-city"
                name="city"
                className={input}
                {...fieldAria("add-city", errors.city)}
              />
            </Field>
            <Field label="Site web" htmlFor="add-website" optionalLabel error={errors.website}>
              <Input
                id="add-website"
                name="website"
                className={input}
                {...fieldAria("add-website", errors.website)}
              />
            </Field>
          </div>
          <Field
            label="Description courte"
            htmlFor="add-description"
            optionalLabel
            error={errors.description}
          >
            <Textarea
              id="add-description"
              name="description"
              rows={2}
              maxLength={300}
              className="text-base"
              {...fieldAria("add-description", errors.description)}
            />
          </Field>
          <Field
            label="Ce que l'entreprise offre"
            htmlFor="add-offers"
            required
            error={errors.offers}
          >
            <TagsInput
              id="add-offers"
              name="offers"
              value={offers}
              onChange={setOffers}
              suggestions={tagSuggestions}
              invalid={Boolean(errors.offers)}
            />
          </Field>
          <Field
            label="Ce que l'entreprise cherche"
            htmlFor="add-needs"
            required
            error={errors.needs}
          >
            <TagsInput
              id="add-needs"
              name="needs"
              value={needs}
              onChange={setNeeds}
              suggestions={tagSuggestions}
              invalid={Boolean(errors.needs)}
            />
          </Field>
          <Field
            label="Objectif pour cet événement"
            htmlFor="add-goalsText"
            optionalLabel
            error={errors.goalsText}
          >
            <Textarea
              id="add-goalsText"
              name="goalsText"
              rows={2}
              maxLength={500}
              className="text-base"
              {...fieldAria("add-goalsText", errors.goalsText)}
            />
          </Field>
          <Field label="Notes internes" htmlFor="add-notes" optionalLabel error={errors.notes}>
            <Textarea
              id="add-notes"
              name="notes"
              rows={2}
              maxLength={2000}
              className="text-base"
              {...fieldAria("add-notes", errors.notes)}
            />
          </Field>
          <label className="flex items-center gap-3 text-base">
            <input
              type="checkbox"
              name="sendEmail"
              defaultChecked
              className="size-5 accent-primary"
            />
            Envoyer le courriel (lien personnel et avis de confidentialité)
          </label>
          <SubmitButton size="lg" pendingLabel="Ajout…" className="w-full sm:w-auto">
            Ajouter l'inscrit
          </SubmitButton>
        </form>
      </SheetContent>
    </Sheet>
  );
}
