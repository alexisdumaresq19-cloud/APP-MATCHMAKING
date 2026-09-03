import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon, ExternalLinkIcon, MapPinIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getPublicCompany } from "@/server/queries/directory";
import { getOrganizationBySlug } from "@/server/queries/public";

type Params = Promise<{ orgSlug: string; id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { orgSlug, id } = await params;
  const organization = await getOrganizationBySlug(orgSlug);
  const company = organization ? await getPublicCompany(organization.id, id) : null;
  if (!organization || !company) return { title: "Entreprise introuvable" };
  return {
    title: `${company.companyName} · ${organization.name}`,
    description:
      company.description ?? `${company.companyName}, membre du réseau de ${organization.name}.`,
  };
}

function TagList({ items, empty }: { items: string[]; empty: string }) {
  if (items.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <ul className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <li key={item}>
          <Badge variant="secondary">{item}</Badge>
        </li>
      ))}
    </ul>
  );
}

/** Public card of a listed company: what the company chose to show, nothing personal (D-36). */
export default async function CompanyPage({ params }: { params: Params }) {
  const { orgSlug, id } = await params;
  const organization = await getOrganizationBySlug(orgSlug);
  if (!organization) notFound();
  const company = await getPublicCompany(organization.id, id);
  if (!company) notFound();

  return (
    <div className="space-y-6">
      <Link
        href={`/${orgSlug}/entreprises`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" aria-hidden="true" />
        Toutes les entreprises
      </Link>
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{company.companyName}</h1>
        <p className="mt-1 text-base text-muted-foreground">
          {company.sector ?? "Secteur non précisé"}
        </p>
        {company.city || company.region ? (
          <p className="mt-1 flex items-center gap-1.5 text-base text-muted-foreground">
            <MapPinIcon className="size-4 shrink-0" aria-hidden="true" />
            {[company.city, company.region].filter(Boolean).join(", ")}
          </p>
        ) : null}
        {company.website ? (
          <a
            href={company.website}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="mt-2 inline-flex items-center gap-1.5 text-brand underline underline-offset-4"
          >
            {company.website.replace(/^https?:\/\//, "")}
            <ExternalLinkIcon className="size-4" aria-hidden="true" />
          </a>
        ) : null}
      </div>

      {company.description ? (
        <p className="text-base leading-relaxed whitespace-pre-line">{company.description}</p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <section className="space-y-2 rounded-lg border bg-card p-4">
          <h2 className="font-semibold">Ce que l&apos;entreprise offre</h2>
          <TagList items={company.offers} empty="Aucune offre indiquée." />
        </section>
        <section className="space-y-2 rounded-lg border bg-card p-4">
          <h2 className="font-semibold">Ce qu&apos;elle recherche</h2>
          <TagList items={company.needs} empty="Aucun besoin indiqué." />
        </section>
        <section className="space-y-2 rounded-lg border bg-card p-4 sm:col-span-2">
          <h2 className="font-semibold">Avec qui elle veut collaborer</h2>
          <TagList items={company.soughtSectors} empty="Aucun secteur ciblé." />
        </section>
      </div>

      <p className="text-sm text-muted-foreground">
        {company.eventsAttended
          ? `A participé à ${company.eventsAttended} événement${company.eventsAttended > 1 ? "s" : ""} de ${organization.name}. `
          : ""}
        Pour rencontrer cette entreprise, inscrivez-vous à un prochain événement : le jumelage tient
        compte des secteurs recherchés de part et d&apos;autre.
      </p>
    </div>
  );
}
