"use client";

import Link from "next/link";
import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  CheckIcon,
  ExpandIcon,
  FlagIcon,
  SearchIcon,
  ShrinkIcon,
  UndoIcon,
  UserRoundPlusIcon,
} from "lucide-react";
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
import { AnimatedNumber } from "@/components/motion/animated-number";
import { AnimatedIcon } from "@/components/ui/animated-icon";
import { Field, FormAlert, fieldAria } from "@/components/shared/form-field";
import { NativeSelect } from "@/components/shared/native-select";
import { SubmitButton } from "@/components/shared/submit-button";
import { EmptyState } from "@/components/shared/empty-state";
import { stripDiacritics } from "@/lib/normalize";
import { checkIn, completeEvent, quickAddCheckedIn, undoCheckIn } from "@/server/actions/checkin";
import { cn } from "@/lib/utils";

export type CheckinRow = {
  registrationId: string;
  name: string;
  company: string;
  sector: string | null;
  status: "REGISTERED" | "CONFIRMED" | "CHECKED_IN" | "NO_SHOW";
  checkedInAt: string | null;
  /** "Table 4" for round 1, when seated. */
  table: string | null;
  initial: string;
};

type Props = {
  eventId: string;
  eventName: string;
  rows: CheckinRow[];
  sectors: { id: string; name: string }[];
  completed: boolean;
  kiosk: boolean;
};

function fold(value: string): string {
  return stripDiacritics(value).toLowerCase();
}

/** The door: alphabetical list, instant search, big « Présent » buttons, walk-ins, closing. */
export function CheckinBoard({
  eventId,
  eventName,
  rows: initialRows,
  sectors,
  completed,
  kiosk,
}: Props) {
  const [rows, setRows] = useState(initialRows);
  const [query, setQuery] = useState("");
  const [pending, startTransition] = useTransition();
  useEffect(() => setRows(initialRows), [initialRows]);

  const present = rows.filter((r) => r.status === "CHECKED_IN").length;
  const expected = rows.filter((r) => r.status !== "NO_SHOW").length;
  const filtered = useMemo(() => {
    const needle = fold(query.trim());
    if (!needle) return rows;
    return rows.filter((r) => fold(r.name).includes(needle) || fold(r.company).includes(needle));
  }, [rows, query]);

  function setStatus(registrationId: string, status: CheckinRow["status"]) {
    setRows((current) =>
      current.map((r) =>
        r.registrationId === registrationId
          ? { ...r, status, checkedInAt: status === "CHECKED_IN" ? new Date().toISOString() : null }
          : r,
      ),
    );
  }

  function onCheckIn(row: CheckinRow) {
    const previous = row.status;
    setStatus(row.registrationId, "CHECKED_IN");
    startTransition(async () => {
      const result = await checkIn(row.registrationId);
      if (result && !result.ok) {
        toast.error(result.formError ?? "Une erreur est survenue.");
        setStatus(row.registrationId, previous);
      }
    });
  }

  function onUndo(row: CheckinRow) {
    setStatus(row.registrationId, "CONFIRMED");
    startTransition(async () => {
      const result = await undoCheckIn(row.registrationId);
      if (result && !result.ok) {
        toast.error(result.formError ?? "Une erreur est survenue.");
        setStatus(row.registrationId, "CHECKED_IN");
      }
    });
  }

  return (
    <div className={cn("space-y-4", kiosk && "mx-auto max-w-3xl")}>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-baseline gap-2 rounded-lg border bg-card px-4 py-2">
          <span className="text-3xl font-bold tabular-nums">
            <AnimatedNumber value={present} duration={0.5} />
          </span>
          <span className="text-base text-muted-foreground">
            / {expected} présent{present > 1 ? "s" : ""}
          </span>
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          {!completed ? <QuickAddSheet eventId={eventId} sectors={sectors} /> : null}
          {kiosk ? (
            <Link
              href={`/admin/events/${eventId}/jour-j`}
              className="inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 text-sm font-medium hover:bg-muted"
            >
              <ShrinkIcon className="size-4" aria-hidden="true" />
              Quitter le plein écran
            </Link>
          ) : (
            <Link
              href={`/admin/events/${eventId}/jour-j/plein-ecran`}
              className="inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 text-sm font-medium hover:bg-muted"
            >
              <ExpandIcon className="size-4" aria-hidden="true" />
              Plein écran (tablette)
            </Link>
          )}
          {!completed ? (
            <FinishEventDialog
              eventId={eventId}
              eventName={eventName}
              present={present}
              expected={expected}
            />
          ) : null}
        </div>
      </div>

      <div className="relative">
        <SearchIcon
          className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Nom ou entreprise…"
          aria-label="Rechercher un inscrit"
          autoFocus={kiosk}
          className={cn("pl-10", kiosk ? "h-14 text-lg" : "h-12 text-base")}
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon="search"
          size="sm"
          title={rows.length === 0 ? "Aucun inscrit" : "Personne ne correspond"}
          description={
            rows.length === 0
              ? "Les inscrits apparaîtront ici."
              : "Vérifiez l'orthographe ou ajoutez la personne sur place."
          }
        />
      ) : (
        <ul className="divide-y rounded-lg border bg-card" aria-busy={pending || undefined}>
          {filtered.map((row) => {
            const isPresent = row.status === "CHECKED_IN";
            return (
              <li
                key={row.registrationId}
                className={cn(
                  "flex items-center gap-3 px-3 py-2",
                  isPresent && "bg-green-50/60",
                  row.status === "NO_SHOW" && "opacity-60",
                )}
              >
                <span
                  className={cn(
                    "flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                    isPresent ? "bg-green-600 text-white" : "bg-muted text-muted-foreground",
                  )}
                  aria-hidden="true"
                >
                  {isPresent ? <CheckIcon className="size-5" /> : row.initial}
                </span>
                <div className="min-w-0 flex-1">
                  <p className={cn("truncate font-medium", kiosk && "text-lg")}>{row.name}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {row.company}
                    {row.sector ? ` · ${row.sector}` : ""}
                  </p>
                </div>
                {row.table ? (
                  <span className="hidden shrink-0 rounded-md bg-brand/10 px-2 py-1 text-sm font-semibold text-brand sm:inline">
                    {row.table}
                  </span>
                ) : null}
                {completed ? (
                  <span className="text-sm text-muted-foreground">
                    {isPresent ? "Présent" : "Absent"}
                  </span>
                ) : isPresent ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size={kiosk ? "lg" : "sm"}
                    className="shrink-0 text-muted-foreground"
                    onClick={() => onUndo(row)}
                    aria-label={`Annuler la présence de ${row.name}`}
                  >
                    <UndoIcon aria-hidden="true" />
                    Annuler
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size={kiosk ? "lg" : "default"}
                    className={cn(
                      "shrink-0 bg-green-600 text-white hover:bg-green-700",
                      kiosk && "min-h-12 px-5 text-base",
                    )}
                    onClick={() => onCheckIn(row)}
                    aria-label={`Marquer ${row.name} présent`}
                  >
                    <CheckIcon aria-hidden="true" />
                    Présent
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function QuickAddSheet({
  eventId,
  sectors,
}: {
  eventId: string;
  sectors: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(quickAddCheckedIn.bind(null, eventId), null);
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  useEffect(() => {
    if (state?.ok) {
      toast.success(state.message ?? "Ajouté.");
      setOpen(false);
    }
  }, [state]);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button variant="outline" className="min-h-10">
            <UserRoundPlusIcon aria-hidden="true" />
            Ajouter sur place
          </Button>
        }
      />
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Ajouter une personne sur place</SheetTitle>
          <SheetDescription>
            Inscription manuelle marquée présente immédiatement. La demande de consentement partira
            par courriel.
          </SheetDescription>
        </SheetHeader>
        <form action={formAction} noValidate className="space-y-4 px-4 pb-6">
          <FormAlert message={state && !state.ok ? state.formError : null} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Prénom" htmlFor="qa-firstName" required error={errors.firstName}>
              <Input
                id="qa-firstName"
                name="firstName"
                className="h-11 text-base"
                {...fieldAria("qa-firstName", errors.firstName)}
              />
            </Field>
            <Field label="Nom" htmlFor="qa-lastName" required error={errors.lastName}>
              <Input
                id="qa-lastName"
                name="lastName"
                className="h-11 text-base"
                {...fieldAria("qa-lastName", errors.lastName)}
              />
            </Field>
          </div>
          <Field label="Courriel" htmlFor="qa-email" required error={errors.email}>
            <Input
              id="qa-email"
              name="email"
              type="email"
              inputMode="email"
              className="h-11 text-base"
              {...fieldAria("qa-email", errors.email)}
            />
          </Field>
          <Field label="Entreprise" htmlFor="qa-companyName" required error={errors.companyName}>
            <Input
              id="qa-companyName"
              name="companyName"
              className="h-11 text-base"
              {...fieldAria("qa-companyName", errors.companyName)}
            />
          </Field>
          <Field label="Secteur" htmlFor="qa-sectorId" optionalLabel error={errors.sectorId}>
            <NativeSelect id="qa-sectorId" name="sectorId" defaultValue="">
              <option value="">Choisir…</option>
              {sectors.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <SubmitButton size="lg" pendingLabel="Ajout…" className="w-full">
            Ajouter et marquer présent
          </SubmitButton>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function FinishEventDialog({
  eventId,
  eventName,
  present,
  expected,
}: {
  eventId: string;
  eventName: string;
  present: number;
  expected: number;
}) {
  const [pending, startTransition] = useTransition();
  const absent = Math.max(0, expected - present);
  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button variant="outline" className="min-h-10" disabled={pending}>
            <FlagIcon aria-hidden="true" />
            Terminer l'événement
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Terminer « {eventName} »?</AlertDialogTitle>
          <AlertDialogDescription>
            {present} présent{present > 1 ? "s" : ""} seront conservés, {absent} inscrit
            {absent > 1 ? "s" : ""} non arrivé{absent > 1 ? "s" : ""} seront marqués absents et le
            relevé de facturation sera figé. Cette action est définitive.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex justify-center py-2">
          <AnimatedIcon name="trophy" size={40} play />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Pas maintenant</AlertDialogCancel>
          <AlertDialogAction
            onClick={() =>
              startTransition(async () => {
                const result = await completeEvent(eventId);
                if (result && !result.ok)
                  toast.error(result.formError ?? "Une erreur est survenue.");
                else toast.success(result?.message ?? "Événement terminé.");
              })
            }
          >
            Terminer et figer la facturation
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
