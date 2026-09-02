import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowDownIcon, ArrowUpIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { FormAlert } from "@/components/shared/form-field";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  RegistrantDrawer,
  type RegistrantSummary,
} from "@/components/admin/registrants/registrant-drawer";
import { RegistrantsFilters } from "@/components/admin/registrants/registrants-filters";
import { AddRegistrantSheet } from "@/components/admin/registrants/add-registrant-sheet";
import { buttonVariants } from "@/components/ui/button";
import { DownloadIcon, UploadIcon } from "lucide-react";
import { getTagSuggestions } from "@/server/queries/tags";
import { appBaseUrl } from "@/lib/auth/participant-session";
import { requireOrganizer } from "@/lib/auth/session";
import { formatDate } from "@/lib/dates";
import { prisma } from "@/lib/db/prisma";
import { registrationSourceLabel, registrationStatusLabel } from "@/lib/labels";
import { REGIONS } from "@/lib/regions";
import { truncate } from "@/lib/text";
import { cn } from "@/lib/utils";
import { registrantsQuerySchema, type RegistrantsQuery } from "@/lib/validation/event";
import { currentConsentVersion } from "@/server/services/consent";
import { suggestedSectorsMap } from "@/server/services/sought-sectors";
import { PAGE_SIZE, getSectors, listRegistrants } from "@/server/queries/admin";

export const metadata: Metadata = { title: "Inscrits" };

function queryString(query: RegistrantsQuery, overrides: Partial<RegistrantsQuery>): string {
  const merged = { ...query, ...overrides };
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(merged)) {
    if (value === undefined || value === "" || (key === "page" && value === 1)) continue;
    params.set(key, String(value));
  }
  const s = params.toString();
  return s ? `?${s}` : "";
}

export default async function RegistrantsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const { organization } = await requireOrganizer();
  const raw = await searchParams;
  const parsedQuery = registrantsQuerySchema.safeParse(
    Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])),
  );
  const query: RegistrantsQuery = parsedQuery.success
    ? parsedQuery.data
    : registrantsQuerySchema.parse({});

  const event = await prisma.event.findFirst({ where: { id, organizationId: organization.id } });
  if (!event) notFound();

  const [sectors, result, tagSuggestions, suggestedSectors] = await Promise.all([
    getSectors(organization.id),
    listRegistrants(event.id, query),
    getTagSuggestions(organization.id),
    suggestedSectorsMap(organization.id),
  ]);
  const consentVersion = currentConsentVersion(organization);
  const consentedIds = new Set(
    (
      await prisma.consentLog.findMany({
        where: { consentVersion, participantId: { in: result.rows.map((r) => r.participantId) } },
        select: { participantId: true },
      })
    ).map((c) => c.participantId),
  );
  const activeSectors = sectors.filter((s) => s.isActive);
  const publicUrl = `${appBaseUrl()}/e/${organization.slug}/${event.slug}`;
  const base = `/admin/events/${event.id}/inscrits`;
  const totalActive = Object.entries(result.statusCounts)
    .filter(([status]) => status !== "CANCELLED")
    .reduce((sum, [, count]) => sum + count, 0);

  const sortLink = (tri: RegistrantsQuery["tri"], label: string) => {
    const active = query.tri === tri;
    const nextOrder = active && query.ordre === "asc" ? "desc" : "asc";
    return (
      <Link
        href={`${base}${queryString(query, { tri, ordre: nextOrder, page: 1 })}`}
        className={cn(
          "inline-flex items-center gap-1 hover:underline",
          active && "text-foreground",
        )}
      >
        {label}
        {active ? (
          query.ordre === "asc" ? (
            <ArrowUpIcon className="size-3.5" aria-hidden="true" />
          ) : (
            <ArrowDownIcon className="size-3.5" aria-hidden="true" />
          )
        ) : null}
      </Link>
    );
  };

  const imported = typeof raw.import === "string" ? Number(raw.import) : null;
  const reused = typeof raw.reutilises === "string" ? Number(raw.reutilises) : 0;
  const ignored = typeof raw.ignores === "string" ? Number(raw.ignores) : 0;

  return (
    <div className="space-y-4">
      {imported !== null ? (
        <FormAlert
          variant="success"
          message={`Importation terminée : ${imported} inscription${imported > 1 ? "s" : ""} ajoutée${imported > 1 ? "s" : ""}${reused ? `, dont ${reused} profil${reused > 1 ? "s" : ""} existant${reused > 1 ? "s" : ""} réutilisé${reused > 1 ? "s" : ""}` : ""}${ignored ? `; ${ignored} déjà inscrit${ignored > 1 ? "s" : ""} ignoré${ignored > 1 ? "s" : ""}` : ""}.`}
        />
      ) : null}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
        <span>
          <strong className="text-foreground">{totalActive}</strong> inscrit
          {totalActive > 1 ? "s" : ""} actif{totalActive > 1 ? "s" : ""}
        </span>
        {Object.entries(result.statusCounts).map(([status, count]) => (
          <span key={status}>
            {registrationStatusLabel(status as RegistrantSummary["status"])} : {count}
          </span>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <AddRegistrantSheet
          eventId={event.id}
          sectors={activeSectors}
          regions={REGIONS}
          tagSuggestions={tagSuggestions}
          suggestedSectors={suggestedSectors}
        />
        <Link
          href={`${base}/import`}
          className={buttonVariants({ variant: "outline", size: "lg" })}
        >
          <UploadIcon aria-hidden="true" />
          Importer un CSV
        </Link>
        <a
          href={`${base}/export.csv${queryString(query, { page: 1 })}`}
          className={buttonVariants({ variant: "outline", size: "lg" })}
        >
          <DownloadIcon aria-hidden="true" />
          Exporter CSV
        </a>
        <a
          href={`${base}/export.xlsx${queryString(query, { page: 1 })}`}
          className={buttonVariants({ variant: "outline", size: "lg" })}
        >
          <DownloadIcon aria-hidden="true" />
          Exporter Excel
        </a>
      </div>

      <RegistrantsFilters
        eventId={event.id}
        query={query}
        sectors={activeSectors}
        regions={REGIONS}
      />

      {result.total === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-base font-medium">
            {totalActive === 0
              ? "Aucun inscrit pour l'instant."
              : "Aucun inscrit ne correspond à ces filtres."}
          </p>
          {totalActive === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Partagez ce lien : <span className="font-mono break-all">{publicUrl}</span>
            </p>
          ) : null}
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{sortLink("nom", "Nom")}</TableHead>
                  <TableHead>{sortLink("entreprise", "Entreprise")}</TableHead>
                  <TableHead className="hidden md:table-cell">Région</TableHead>
                  <TableHead>{sortLink("statut", "Statut")}</TableHead>
                  <TableHead className="hidden lg:table-cell">Source</TableHead>
                  <TableHead className="hidden lg:table-cell">
                    {sortLink("date", "Inscrit le")}
                  </TableHead>
                  <TableHead className="hidden xl:table-cell">Offres / besoins</TableHead>
                  <TableHead className="text-right">Matchs</TableHead>
                  <TableHead className="text-right">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.rows.map((row) => {
                  const p = row.participant;
                  const consentPending = !consentedIds.has(p.id);
                  const summary: RegistrantSummary = {
                    registrationId: row.id,
                    status: row.status,
                    source: row.source,
                    consentPending,
                    notes: row.notes,
                    goalsText: row.goalsText,
                    createdAtLabel: formatDate(row.createdAt, organization.timezone, "short"),
                    profile: {
                      firstName: p.firstName,
                      lastName: p.lastName,
                      email: p.email,
                      phone: p.phone,
                      jobTitle: p.jobTitle,
                      companyName: p.companyName,
                      sectorId: p.sectorId,
                      region: p.region,
                      city: p.city,
                      website: p.website,
                      description: p.description,
                      offers: p.offers,
                      needs: p.needs,
                      soughtSectorIds: p.soughtSectorIds,
                    },
                  };
                  return (
                    <TableRow
                      key={row.id}
                      className={cn(row.status === "CANCELLED" && "opacity-60")}
                    >
                      <TableCell>
                        <div className="font-medium">
                          {p.firstName} {p.lastName}
                        </div>
                        <div className="text-xs text-muted-foreground">{p.email}</div>
                      </TableCell>
                      <TableCell>
                        <div>{p.companyName}</div>
                        <div className="text-xs text-muted-foreground">
                          {p.sector?.name ?? <span className="text-amber-700">Sans secteur</span>}
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">{p.region ?? "—"}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          <Badge variant="secondary">{registrationStatusLabel(row.status)}</Badge>
                          {consentPending ? (
                            <Badge className="bg-amber-100 text-amber-900">
                              Consentement en attente
                            </Badge>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {registrationSourceLabel(row.source)}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {formatDate(row.createdAt, organization.timezone, "short")}
                      </TableCell>
                      <TableCell className="hidden max-w-[260px] xl:table-cell">
                        <div className="truncate text-xs" title={`Offre : ${p.offers.join(", ")}`}>
                          <span className="text-muted-foreground">Offre :</span>{" "}
                          {truncate(p.offers.join(", "), 60) || "—"}
                        </div>
                        <div className="truncate text-xs" title={`Cherche : ${p.needs.join(", ")}`}>
                          <span className="text-muted-foreground">Cherche :</span>{" "}
                          {truncate(p.needs.join(", "), 60) || "—"}
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row._count.matchesAsA + row._count.matchesAsB}
                      </TableCell>
                      <TableCell className="text-right">
                        <RegistrantDrawer
                          registrant={summary}
                          sectors={activeSectors}
                          regions={REGIONS}
                          tagSuggestions={tagSuggestions}
                          suggestedSectors={suggestedSectors}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
            <span>
              {result.total} résultat{result.total > 1 ? "s" : ""} · page {query.page} sur{" "}
              {result.pageCount} ({PAGE_SIZE} par page)
            </span>
            <div className="flex gap-2">
              {query.page > 1 ? (
                <Link
                  href={`${base}${queryString(query, { page: query.page - 1 })}`}
                  className="rounded-lg border px-3 py-2 hover:bg-muted"
                >
                  Précédent
                </Link>
              ) : null}
              {query.page < result.pageCount ? (
                <Link
                  href={`${base}${queryString(query, { page: query.page + 1 })}`}
                  className="rounded-lg border px-3 py-2 hover:bg-muted"
                >
                  Suivant
                </Link>
              ) : null}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
