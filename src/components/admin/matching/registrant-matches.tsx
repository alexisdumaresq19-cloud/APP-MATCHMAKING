"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { BanIcon, PinIcon, PinOffIcon, UndoIcon, UserPlusIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/shared/native-select";
import { setMatchStatus } from "@/server/actions/matching";
import type { PersonSummary, RegistrantMatches } from "@/server/queries/matching";
import type { ActionState } from "@/server/actions/types";
import { cn } from "@/lib/utils";

export function RegistrantMatchesCard({
  eventId,
  row,
  eligible,
}: {
  eventId: string;
  row: RegistrantMatches;
  eligible: PersonSummary[];
}) {
  const [pending, startTransition] = useTransition();
  const [manualPartner, setManualPartner] = useState("");
  const proposed = row.matches.filter((m) => m.status !== "EXCLUDED");
  const excluded = row.matches.filter((m) => m.status === "EXCLUDED");
  const partnerIds = new Set(row.matches.map((m) => m.partner.registrationId));

  function run(fn: () => Promise<ActionState>) {
    startTransition(async () => {
      const result = await fn();
      if (result && !result.ok) toast.error(result.formError ?? "Une erreur est survenue.");
      else if (result?.ok && result.message) toast.success(result.message);
    });
  }

  return (
    <article className="rounded-lg border bg-card">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
        <div className="min-w-0">
          <h3 className="text-base font-semibold">{row.person.name}</h3>
          <p className="truncate text-sm text-muted-foreground">
            {row.person.company}
            {row.person.sector ? ` · ${row.person.sector}` : " · sans secteur"}
            {row.person.region ? ` · ${row.person.region}` : ""}
          </p>
        </div>
        <Badge variant={proposed.length < 2 ? "destructive" : "secondary"}>
          {proposed.length} jumelage{proposed.length > 1 ? "s" : ""}
        </Badge>
      </header>
      <ul className="divide-y">
        {proposed.map((match) => (
          <li
            key={match.matchId}
            className={cn(
              "flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start sm:justify-between",
              match.status === "PINNED" && "bg-amber-50/60",
            )}
          >
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{match.partner.name}</span>
                <span className="text-sm text-muted-foreground">
                  {match.partner.company}
                  {match.partner.sector ? ` · ${match.partner.sector}` : ""}
                </span>
                <Badge variant="outline" className="tabular-nums">
                  {match.score}
                </Badge>
                {match.status === "PINNED" ? (
                  <Badge className="bg-amber-200 text-amber-950">Épinglé</Badge>
                ) : null}
              </div>
              <ul className="text-sm text-muted-foreground">
                {match.sentences.map((sentence) => (
                  <li key={sentence}>{sentence}</li>
                ))}
              </ul>
            </div>
            <div className="flex shrink-0 gap-1">
              {match.status === "PINNED" ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={pending}
                  onClick={() =>
                    run(() =>
                      setMatchStatus(
                        eventId,
                        row.person.registrationId,
                        match.partner.registrationId,
                        "PROPOSED",
                      ),
                    )
                  }
                >
                  <PinOffIcon aria-hidden="true" />
                  Désépingler
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={pending}
                  onClick={() =>
                    run(() =>
                      setMatchStatus(
                        eventId,
                        row.person.registrationId,
                        match.partner.registrationId,
                        "PINNED",
                      ),
                    )
                  }
                >
                  <PinIcon aria-hidden="true" />
                  Épingler
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive"
                disabled={pending}
                onClick={() =>
                  run(() =>
                    setMatchStatus(
                      eventId,
                      row.person.registrationId,
                      match.partner.registrationId,
                      "EXCLUDED",
                    ),
                  )
                }
              >
                <BanIcon aria-hidden="true" />
                Exclure
              </Button>
            </div>
          </li>
        ))}
        {proposed.length === 0 ? (
          <li className="px-4 py-3 text-sm text-muted-foreground">
            Aucun jumelage proposé pour l'instant.
          </li>
        ) : null}
      </ul>
      {excluded.length ? (
        <div className="border-t px-4 py-2 text-sm text-muted-foreground">
          Exclus :{" "}
          {excluded.map((match, index) => (
            <span key={match.matchId}>
              {index > 0 ? ", " : ""}
              {match.partner.name}{" "}
              <button
                type="button"
                className="underline underline-offset-2 hover:text-foreground"
                disabled={pending}
                onClick={() =>
                  run(() =>
                    setMatchStatus(
                      eventId,
                      row.person.registrationId,
                      match.partner.registrationId,
                      "PROPOSED",
                    ),
                  )
                }
              >
                <UndoIcon className="mr-0.5 inline size-3" aria-hidden="true" />
                rétablir
              </button>
            </span>
          ))}
        </div>
      ) : null}
      <form
        className="flex flex-col gap-2 border-t px-4 py-3 sm:flex-row sm:items-center"
        onSubmit={(event) => {
          event.preventDefault();
          if (!manualPartner) return;
          run(async () => {
            const result = await setMatchStatus(
              eventId,
              row.person.registrationId,
              manualPartner,
              "PINNED",
            );
            if (result?.ok) setManualPartner("");
            return result;
          });
        }}
      >
        <label htmlFor={`manual-${row.person.registrationId}`} className="text-sm font-medium">
          Jumelage manuel
        </label>
        <NativeSelect
          id={`manual-${row.person.registrationId}`}
          value={manualPartner}
          onChange={(e) => setManualPartner(e.target.value)}
          className="h-10 sm:max-w-sm"
        >
          <option value="">Choisir une personne…</option>
          {eligible
            .filter(
              (p) =>
                p.registrationId !== row.person.registrationId && !partnerIds.has(p.registrationId),
            )
            .map((p) => (
              <option key={p.registrationId} value={p.registrationId}>
                {p.name} · {p.company}
              </option>
            ))}
        </NativeSelect>
        <Button type="submit" variant="outline" size="sm" disabled={pending || !manualPartner}>
          <UserPlusIcon aria-hidden="true" />
          Épingler
        </Button>
      </form>
    </article>
  );
}
