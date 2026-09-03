import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRightIcon, MapPinIcon, SearchIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TextReveal } from "@/components/motion/text-reveal";
import { EmptyState } from "@/components/shared/empty-state";
import { NativeSelect } from "@/components/shared/native-select";
import { REGIONS } from "@/lib/regions";
import { cn } from "@/lib/utils";
import { companiesQuerySchema } from "@/lib/validation/directory";
import { listPublicCompanies } from "@/server/queries/directory";
import { getActiveSectors, getOrganizationBySlug } from "@/server/queries/public";

type Params = Promise<{ orgSlug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { orgSlug } = await params;
  const organization = await getOrganizationBySlug(orgSlug);
  if (!organization) return { title: "Organisation introuvable" };
  return {
    title: `Entreprises · ${organization.name}`,
    description: `Les entreprises membres du réseau de ${organization.name}, par secteur et par région.`,
  };
}

/** Public directory of the companies that chose to be listed (Phase 2, D-36). */
export default async function CompaniesDirectoryPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { orgSlug } = await params;
  const organization = await getOrganizationBySlug(orgSlug);
  if (!organization) notFound();
  const raw = await searchParams;
  const parsed = companiesQuerySchema.safeParse(
    Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])),
  );
  const query = parsed.success ? parsed.data : companiesQuerySchema.parse({});
  const [result, sectors] = await Promise.all([
    listPublicCompanies(organization.id, query),
    getActiveSectors(organization.id),
  ]);
  const filtering = Boolean(query.q || query.secteur || query.region);
  const pageLink = (page: number) => {
    const params = new URLSearchParams();
    if (query.q) params.set("q", query.q);
    if (query.secteur) params.set("secteur", query.secteur);
    if (query.region) params.set("region", query.region);
    if (page > 1) params.set("page", String(page));
    const s = params.toString();
    return `/${orgSlug}/entreprises${s ? `?${s}` : ""}`;
  };

  return (
    <div className="space-y-6">
      <div>
        <TextReveal
          as="h1"
          text="Les entreprises du réseau"
          className="text-3xl font-bold tracking-tight sm:text-4xl"
        />
        <p className="mt-2 text-base text-muted-foreground">
          {result.total} entreprise{result.total > 1 ? "s" : ""} inscrite
          {result.total > 1 ? "s" : ""} aux événements de {organization.name} et qui ont choisi
          d&apos;apparaître ici. Votre entreprise?{" "}
          <Link href={`/${orgSlug}`} className="text-brand underline underline-offset-4">
            Inscrivez-vous à un événement
          </Link>
          , puis activez l&apos;annuaire dans votre profil.
        </p>
      </div>

      <form method="get" className="flex flex-wrap gap-2">
        <div className="relative min-w-56 flex-1">
          <SearchIcon
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            name="q"
            defaultValue={query.q ?? ""}
            placeholder="Entreprise, service, ville…"
            aria-label="Rechercher une entreprise"
            className="h-11 pl-9 text-base"
          />
        </div>
        <NativeSelect
          name="secteur"
          defaultValue={query.secteur ?? ""}
          aria-label="Secteur"
          className="h-11 w-auto"
        >
          <option value="">Tous les secteurs</option>
          {sectors.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect
          name="region"
          defaultValue={query.region ?? ""}
          aria-label="Région"
          className="h-11 w-auto"
        >
          <option value="">Toutes les régions</option>
          {REGIONS.map((region) => (
            <option key={region} value={region}>
              {region}
            </option>
          ))}
        </NativeSelect>
        <button
          type="submit"
          className={cn(
            buttonVariants({ size: "lg" }),
            "h-11 bg-brand text-brand-foreground hover:bg-brand/90",
          )}
        >
          Rechercher
        </button>
      </form>

      {result.rows.length === 0 ? (
        <EmptyState
          icon="users-round"
          title={filtering ? "Aucune entreprise ne correspond" : "Aucune entreprise pour l'instant"}
          description={
            filtering
              ? "Essayez un autre mot ou retirez un filtre."
              : "Les entreprises apparaissent ici dès qu'elles activent l'annuaire dans leur profil."
          }
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {result.rows.map((company) => (
            <li key={company.id}>
              <Link
                href={`/${orgSlug}/entreprises/${company.id}`}
                className="flex h-full flex-col gap-3 rounded-lg border bg-card p-4 transition-colors hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-lg font-semibold">{company.companyName}</p>
                    <p className="text-sm text-muted-foreground">
                      {company.sector ?? "Secteur non précisé"}
                    </p>
                  </div>
                  <ChevronRightIcon
                    className="size-5 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                </div>
                {company.city || company.region ? (
                  <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <MapPinIcon className="size-4 shrink-0" aria-hidden="true" />
                    {[company.city, company.region].filter(Boolean).join(", ")}
                  </p>
                ) : null}
                {company.offers.length ? (
                  <ul className="flex flex-wrap gap-1.5">
                    {company.offers.slice(0, 4).map((offer) => (
                      <li key={offer}>
                        <Badge variant="secondary">{offer}</Badge>
                      </li>
                    ))}
                    {company.offers.length > 4 ? (
                      <li className="text-xs text-muted-foreground">
                        +{company.offers.length - 4}
                      </li>
                    ) : null}
                  </ul>
                ) : null}
                {company.eventsAttended ? (
                  <p className="mt-auto text-xs text-muted-foreground">
                    A participé à {company.eventsAttended} événement
                    {company.eventsAttended > 1 ? "s" : ""}
                  </p>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}

      {result.pageCount > 1 ? (
        <nav aria-label="Pagination" className="flex items-center justify-between text-sm">
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
    </div>
  );
}
