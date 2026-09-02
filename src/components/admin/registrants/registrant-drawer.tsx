"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { MailIcon, UserRoundXIcon } from "lucide-react";
import type { RegistrationSource, RegistrationStatus } from "@prisma/client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/shared/form-field";
import { NativeSelect } from "@/components/shared/native-select";
import { ProfileForm, type ProfileFormValues } from "@/components/participant/profile-form";
import {
  REGISTRATION_STATUSES,
  registrationSourceLabel,
  registrationStatusLabel,
} from "@/lib/labels";
import {
  changeRegistrationStatus,
  resendParticipantLink,
  updateRegistrantProfile,
} from "@/server/actions/registrations";

export type RegistrantSummary = {
  registrationId: string;
  status: RegistrationStatus;
  source: RegistrationSource;
  consentPending: boolean;
  notes: string | null;
  goalsText: string | null;
  createdAtLabel: string;
  profile: ProfileFormValues;
};

type Props = {
  registrant: RegistrantSummary;
  sectors: { id: string; name: string }[];
  regions: readonly string[];
  tagSuggestions?: string[];
};

export function RegistrantDrawer({ registrant, sectors, regions, tagSuggestions = [] }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const { profile } = registrant;

  function run(
    fn: () => Promise<{ ok: boolean; message?: string; formError?: string } | null>,
    close = false,
  ) {
    startTransition(async () => {
      const result = await fn();
      if (result && !result.ok) toast.error(result.formError ?? "Une erreur est survenue.");
      else {
        toast.success(result?.message ?? "Fait.");
        if (close) setOpen(false);
      }
    });
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button variant="outline" size="sm">
            Ouvrir
          </Button>
        }
      />
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle className="text-xl">
            {profile.firstName} {profile.lastName}
          </SheetTitle>
          <SheetDescription>
            {profile.companyName} · {profile.email}
          </SheetDescription>
          <div className="flex flex-wrap gap-2 pt-1">
            <Badge variant="secondary">{registrationStatusLabel(registrant.status)}</Badge>
            <Badge variant="outline">{registrationSourceLabel(registrant.source)}</Badge>
            {registrant.consentPending ? (
              <Badge className="bg-amber-100 text-amber-900">Consentement en attente</Badge>
            ) : null}
            <span className="text-xs text-muted-foreground">
              Inscrit le {registrant.createdAtLabel}
            </span>
          </div>
        </SheetHeader>

        <div className="space-y-6 px-4 pb-6">
          <section className="space-y-3 rounded-lg border p-3">
            <Field label="Statut de l'inscription" htmlFor={`status-${registrant.registrationId}`}>
              <NativeSelect
                id={`status-${registrant.registrationId}`}
                defaultValue={registrant.status}
                disabled={pending}
                onChange={(event) =>
                  run(() =>
                    changeRegistrationStatus(
                      registrant.registrationId,
                      event.target.value as RegistrationStatus,
                    ),
                  )
                }
              >
                {REGISTRATION_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {registrationStatusLabel(status)}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="lg"
                disabled={pending}
                onClick={() => run(() => resendParticipantLink(registrant.registrationId))}
              >
                <MailIcon aria-hidden="true" />
                {registrant.consentPending
                  ? "Renvoyer la demande de consentement"
                  : "Renvoyer le lien"}
              </Button>
              {registrant.status !== "CANCELLED" ? (
                <AlertDialog>
                  <AlertDialogTrigger
                    render={
                      <Button type="button" variant="destructive" size="lg" disabled={pending}>
                        <UserRoundXIcon aria-hidden="true" />
                        Retirer
                      </Button>
                    }
                  />
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Retirer cette personne de l'événement?</AlertDialogTitle>
                      <AlertDialogDescription>
                        L'inscription passera au statut « Annulé ». Le profil est conservé et la
                        personne ne sera ni jumelée ni placée à une table. Vous pourrez la
                        réinscrire en changeant le statut.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Annuler</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() =>
                          run(
                            () => changeRegistrationStatus(registrant.registrationId, "CANCELLED"),
                            true,
                          )
                        }
                      >
                        Retirer
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              ) : null}
            </div>
          </section>

          {registrant.goalsText ? (
            <section className="rounded-lg bg-muted/50 p-3 text-sm">
              <p className="font-medium">Ce que la personne espère retirer de l'événement</p>
              <p className="mt-1 whitespace-pre-line text-muted-foreground">
                {registrant.goalsText}
              </p>
            </section>
          ) : null}

          <ProfileForm
            key={registrant.registrationId}
            action={updateRegistrantProfile.bind(null, registrant.registrationId)}
            initial={profile}
            sectors={sectors}
            regions={regions}
            tagSuggestions={tagSuggestions}
            submitClassName="w-full sm:w-auto"
            extraFields={
              <Field
                label="Notes internes"
                htmlFor={`notes-${registrant.registrationId}`}
                hint="Visibles seulement par votre équipe."
              >
                <Textarea
                  id={`notes-${registrant.registrationId}`}
                  name="notes"
                  rows={3}
                  defaultValue={registrant.notes ?? ""}
                  maxLength={2000}
                  className="text-base"
                />
              </Field>
            }
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
