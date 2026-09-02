import type { Metadata } from "next";
import Link from "next/link";
import { SearchIcon, ShieldAlertIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/admin/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { NativeSelect } from "@/components/shared/native-select";
import { requireOrganizer } from "@/lib/auth/session";
import { formatDate } from "@/lib/dates";
import { participantsQuerySchema } from "@/lib/validation/organization";
import { getSectors } from "@/server/queries/admin";
import { countPendingDeletions, listDirectory } from "@/server/queries/participants";
import { currentConsentVersion } from "@/server/services/consent";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Participants" };

/** The directory of every participant of the organization, across events (S4-06). */
export default async function ParticipantsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { organization } = await requireOrganizer();
  const raw = await searchParams;
  const parsed = participantsQuerySchema.safeParse(
    Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])),
  );
  const query = parsed.success ? parsed.data : participantsQuerySchema.parse({});
  const [result, sectors, pendingDeletions] = await Promise.all([
    listDirectory(organization.id, currentConsentVersion(organization), query),
    getSectors(organization.id),
    countPendingDeletions(organization.id),
  ]);
  const pageLink = (page: number) => {
    const params = new URLSearchParams();
    if (query.q) params.set("q", query.q);
    if (query.secteur) params.set("secteur", query.secteur);
    if (page > 1) params.set("page", String(page));
    const s = params.toString();
    return `/admin/participants${s ? `?${s}` : ""}`;
  };

  return (
    <>
      <PageHeader
        title="Participants"
        description={`${result.total} participant${result.total > 1 ? "s" : ""} dans votre annuaire, tous événements confondus.`}
        actions={
          <Link
            href="/admin/participants/suppressions"
            className={cn(
              buttonVariants({ variant: pendingDeletions ? "default" : "outline", size: "lg" }),
            )}
          >
            <ShieldAlertIcon aria-hidden="true" />
            Demandes de suppression
            {pendingDeletions ? (
              <span className="ml-1 rounded-full bg-background/20 px-2 text-xs tabular-nums">
                {pendingDeletions}
              </span>
            ) : null}
          </Link>
        }
      />
      <form method="get" className="mb-4 flex flex-wrap gap-2">
        <div className="relative min-w-60 flex-1">
          <SearchIcon
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            name="q"
            defaultValue={query.q ?? ""}
            placeholder="Nom, entreprise ou courriel…"
            aria-label="Rechercher un participant"
            className="h-10 pl-9"
          />
        </div>
        <NativeSelect
          name="secteur"
          defaultValue={query.secteur ?? ""}
          aria-label="Secteur"
          className="h-10 w-auto"
        >
          <option value="">Tous les secteurs</option>
          {sectors.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </NativeSelect>
        <button type="submit" className={buttonVariants({ variant: "outline", size: "lg" })}>
          Filtrer
        </button>
      </form>

      {result.rows.length === 0 ? (
        <EmptyState
          icon="users"
          title={query.q || query.secteur ? "Aucun participant ne correspond" : "Aucun participant"}
          description={
            query.q || query.secteur
              ? "Essayez un autre nom ou retirez le filtre."
              : "Les personnes inscrites à vos événements apparaîtront ici."
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Entreprise</TableHead>
                <TableHead className="hidden md:table-cell">Région</TableHead>
                <TableHead className="text-right">Événements</TableHead>
                <TableHead className="hidden lg:table-cell">Dernier événement</TableHead>
                <TableHead>Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.rows.map((row) => (
                <TableRow key={row.id} className={cn(row.deletedAt && "opacity-60")}>
                  <TableCell>
                    <Link
                      href={`/admin/participants/${row.id}`}
                      className="font-medium hover:underline"
                    >
                      {row.name}
                    </Link>
                    <div className="text-xs text-muted-foreground">{row.email}</div>
                  </TableCell>
                  <TableCell>
                    <div>{row.company}</div>
                    <div className="text-xs text-muted-foreground">
                      {row.sector ?? "Sans secteur"}
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">{row.region ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.registrations}</TableCell>
                  <TableCell className="hidden lg:table-cell">
                    {row.lastEvent
                      ? `${row.lastEvent.name} · ${formatDate(row.lastEvent.startsAt, organization.timezone, "date")}`
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {row.deletedAt ? (
                        <Badge variant="outline">Anonymisé</Badge>
                      ) : row.pendingDeletion ? (
                        <Badge className="bg-amber-100 text-amber-900">Suppression demandée</Badge>
                      ) : row.consented ? (
                        <Badge className="bg-green-100 text-green-900">Consentement à jour</Badge>
                      ) : (
                        <Badge variant="secondary">Consentement en attente</Badge>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {result.pageCount > 1 ? (
        <nav aria-label="Pagination" className="mt-4 flex items-center justify-between text-sm">
          <Link
            href={pageLink(Math.max(1, query.page - 1))}
            aria-disabled={query.page <= 1}
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              query.page <= 1 && "pointer-events-none opacity-50",
            )}
          >
            Précédent
          </Link>
          <span className="text-muted-foreground">
            Page {query.page} / {result.pageCount}
          </span>
          <Link
            href={pageLink(Math.min(result.pageCount, query.page + 1))}
            aria-disabled={query.page >= result.pageCount}
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              query.page >= result.pageCount && "pointer-events-none opacity-50",
            )}
          >
            Suivant
          </Link>
        </nav>
      ) : null}
    </>
  );
}
