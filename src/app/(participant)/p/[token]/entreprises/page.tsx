import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MapPinIcon, SearchIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ContactActions } from "@/components/participant/contact-actions";
import { EmptyState } from "@/components/shared/empty-state";
import { FormAlert } from "@/components/shared/form-field";
import { NativeSelect } from "@/components/shared/native-select";
import { resolveParticipantAccess } from "@/lib/auth/participant-session";
import { REGIONS } from "@/lib/regions";
import { cn } from "@/lib/utils";
import { companiesQuerySchema } from "@/lib/validation/directory";
import { listPublicCompanies } from "@/server/queries/directory";
import { getActiveSectors } from "@/server/queries/public";
import { contactIdsOf } from "@/server/services/contacts";

export const metadata: Metadata = { title: "Entreprises" };

/** The directory seen from the participant space: same cards, plus « Message » and contacts. */
export default async function ParticipantCompaniesPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { token } = await params;
  const context = await resolveParticipantAccess(token);
  if (!context) notFound();
  const { participant, organization } = context;
  const raw = await searchParams;
  const parsed = companiesQuerySchema.safeParse(
    Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])),
  );
  const query = parsed.success ? parsed.data : companiesQuerySchema.parse({});
  const [result, sectors, contactIds] = await Promise.all([
    listPublicCompanies(organization.id, query),
    getActiveSectors(organization.id),
    contactIdsOf(participant.id),
  ]);
  const filtering = Boolean(query.q || query.secteur || query.region);
  const pageLink = (page: number) => {
    const p = new URLSearchParams();
    if (query.q) p.set("q", query.q);
    if (query.secteur) p.set("secteur", query.secteur);
    if (query.region) p.set("region", query.region);
    if (page > 1) p.set("page", String(page));
    const s = p.toString();
    return `/p/${token}/entreprises${s ? `?${s}` : ""}`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Les entreprises du réseau</h1>
        <p className="mt-1 text-base text-muted-foreground">
          {result.total} entreprise{result.total > 1 ? "s" : ""} ont choisi d&apos;apparaître dans
          l&apos;annuaire. Écrivez-leur ou gardez-les dans vos contacts.
        </p>
      </div>

      {!participant.directoryOptIn ? (
        <div className="space-y-2">
          <FormAlert
            variant="info"
            message="Pour écrire aux entreprises de l'annuaire, affichez la vôtre aussi. Les entreprises avec lesquelles vous avez été jumelé restent joignables depuis vos jumelages."
          />
          <Link
            href={`/p/${token}/profil#annuaire`}
            className="inline-block text-sm text-brand underline underline-offset-4"
          >
            Activer ma fiche publique
          </Link>
        </div>
      ) : null}

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
          className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-11")}
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
        <ul className="space-y-3">
          {result.rows.map((company) => {
            const self = company.id === participant.id;
            return (
              <li key={company.id} className="space-y-3 rounded-lg border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link
                      href={`/${organization.slug}/entreprises/${company.id}`}
                      className="text-lg font-semibold hover:underline"
                    >
                      {company.companyName}
                    </Link>
                    <p className="text-sm text-muted-foreground">
                      {company.sector ?? "Secteur non précisé"}
                      {self ? " · votre entreprise" : ""}
                    </p>
                    {company.city || company.region ? (
                      <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <MapPinIcon className="size-4 shrink-0" aria-hidden="true" />
                        {[company.city, company.region].filter(Boolean).join(", ")}
                      </p>
                    ) : null}
                  </div>
                  {!self ? (
                    <ContactActions
                      token={token}
                      participantId={company.id}
                      isContact={contactIds.has(company.id)}
                      canMessage={participant.directoryOptIn}
                      compact
                    />
                  ) : null}
                </div>
                {company.offers.length ? (
                  <ul className="flex flex-wrap gap-1.5">
                    {company.offers.slice(0, 5).map((offer) => (
                      <li key={offer}>
                        <Badge variant="secondary">{offer}</Badge>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {result.pageCount > 1 ? (
        <nav aria-label="Pagination" className="flex items-center justify-between text-sm">
          <Link
            href={pageLink(Math.max(1, query.page - 1))}
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
