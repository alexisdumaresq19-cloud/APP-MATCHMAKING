"use client";

import { useRef } from "react";
import { SearchIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/shared/native-select";
import { Button } from "@/components/ui/button";
import { REGISTRATION_STATUSES, registrationStatusLabel } from "@/lib/labels";
import type { RegistrantsQuery } from "@/lib/validation/event";

type Props = {
  eventId: string;
  query: RegistrantsQuery;
  sectors: { id: string; name: string }[];
  regions: readonly string[];
};

export function RegistrantsFilters({ eventId, query, sectors, regions }: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const submit = () => formRef.current?.requestSubmit();
  const hasFilters = Boolean(
    query.q || query.statut || query.secteur || query.region || query.source,
  );

  return (
    <form
      ref={formRef}
      method="get"
      className="grid gap-3 rounded-lg border bg-card p-3 sm:grid-cols-2 lg:grid-cols-6"
    >
      <input type="hidden" name="tri" value={query.tri} />
      <input type="hidden" name="ordre" value={query.ordre} />
      <div className="relative sm:col-span-2">
        <SearchIcon
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          name="q"
          defaultValue={query.q ?? ""}
          placeholder="Rechercher un nom, une entreprise, un courriel…"
          aria-label="Rechercher"
          className="h-10 pl-9"
        />
      </div>
      <NativeSelect
        name="statut"
        defaultValue={query.statut ?? ""}
        onChange={submit}
        aria-label="Statut"
        className="h-10"
      >
        <option value="">Tous les statuts</option>
        {REGISTRATION_STATUSES.map((status) => (
          <option key={status} value={status}>
            {registrationStatusLabel(status)}
          </option>
        ))}
      </NativeSelect>
      <NativeSelect
        name="secteur"
        defaultValue={query.secteur ?? ""}
        onChange={submit}
        aria-label="Secteur"
        className="h-10"
      >
        <option value="">Tous les secteurs</option>
        {sectors.map((sector) => (
          <option key={sector.id} value={sector.id}>
            {sector.name}
          </option>
        ))}
      </NativeSelect>
      <NativeSelect
        name="region"
        defaultValue={query.region ?? ""}
        onChange={submit}
        aria-label="Région"
        className="h-10"
      >
        <option value="">Toutes les régions</option>
        {regions.map((region) => (
          <option key={region} value={region}>
            {region}
          </option>
        ))}
      </NativeSelect>
      <div className="flex gap-2">
        <NativeSelect
          name="source"
          defaultValue={query.source ?? ""}
          onChange={submit}
          aria-label="Source"
          className="h-10"
        >
          <option value="">Toutes les sources</option>
          <option value="PLATFORM">En ligne</option>
          <option value="MANUAL">Ajout manuel</option>
          <option value="IMPORT">Importation</option>
        </NativeSelect>
        <Button type="submit" variant="outline" className="h-10 shrink-0">
          Filtrer
        </Button>
        {hasFilters ? (
          <Link
            href={`/admin/events/${eventId}/inscrits`}
            className="flex size-10 shrink-0 items-center justify-center rounded-lg border hover:bg-muted"
            aria-label="Réinitialiser les filtres"
          >
            <XIcon className="size-4" aria-hidden="true" />
          </Link>
        ) : null}
      </div>
    </form>
  );
}
