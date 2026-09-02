import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BrandProvider } from "@/components/shared/brand-provider";
import { PoweredBy } from "@/components/shared/powered-by";
import { OrganizationHeader } from "@/components/public/organization-header";
import { formatDate } from "@/lib/dates";
import { paragraphs } from "@/lib/text";
import { getOrganizationBySlug } from "@/server/queries/public";

export const metadata: Metadata = { title: "Confidentialité" };

export default async function PrivacyPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const organization = await getOrganizationBySlug(orgSlug);
  if (!organization) notFound();

  return (
    <BrandProvider colors={organization}>
      <div className="flex min-h-dvh flex-col">
        <OrganizationHeader organization={organization} />
        <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 py-8 sm:px-6">
          <h1 className="text-3xl font-bold tracking-tight">
            Protection des renseignements personnels
          </h1>
          <p className="text-muted-foreground">
            Voici l'avis que vous acceptez lors de votre inscription à un événement de{" "}
            {organization.name}. Dernière mise à jour :{" "}
            {formatDate(organization.updatedAt, organization.timezone, "date")}.
          </p>
          <div className="space-y-4 rounded-lg border bg-card p-5 text-base leading-relaxed">
            {paragraphs(organization.consentText).map((p, index) => (
              <p key={index} className="whitespace-pre-line">
                {p}
              </p>
            ))}
          </div>
          <section className="space-y-2">
            <h2 className="text-xl font-semibold">Vos droits</h2>
            <p>
              Vous pouvez en tout temps consulter, rectifier ou demander la suppression de vos
              renseignements depuis votre espace participant (lien reçu par courriel) ou en écrivant
              au responsable de la protection des renseignements personnels :{" "}
              <a
                href={`mailto:${organization.privacyEmail}`}
                className="text-brand underline underline-offset-4"
              >
                {organization.privacyEmail}
              </a>
              .
            </p>
            <p className="text-muted-foreground">
              La plateforme est fournie et hébergée par AD Création (Gaspé, Québec). Aucun outil de
              suivi publicitaire ni de mesure d'audience tiers n'est utilisé.
            </p>
          </section>
        </main>
        <footer className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6">
          <PoweredBy />
        </footer>
      </div>
    </BrandProvider>
  );
}
