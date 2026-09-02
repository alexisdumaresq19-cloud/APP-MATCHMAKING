import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon, DownloadIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { ImportWizard } from "@/components/admin/registrants/import-wizard";
import { requireOrganizer } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { IMPORT_COLUMNS } from "@/lib/import/registrants";

export const metadata: Metadata = { title: "Importer des inscrits" };

export default async function ImportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { organization } = await requireOrganizer();
  const event = await prisma.event.findFirst({
    where: { id, organizationId: organization.id },
    select: { id: true },
  });
  if (!event) notFound();
  const base = `/admin/events/${event.id}/inscrits`;

  return (
    <div className="space-y-6">
      <Link
        href={base}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" aria-hidden="true" />
        Retour aux inscrits
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Importer un fichier CSV</h2>
          <p className="max-w-2xl text-base text-muted-foreground">
            Une ligne par personne. Les profils déjà connus (même courriel) sont réutilisés. Les
            personnes importées reçoivent le statut « Consentement en attente » jusqu'à ce qu'elles
            acceptent l'avis via leur lien; utilisez « Renvoyer la demande de consentement » dans
            leur fiche, ou l'envoi groupé de la publication.
          </p>
        </div>
        <a
          href={`${base}/import/modele.csv`}
          download
          className={buttonVariants({ variant: "outline", size: "lg" })}
        >
          <DownloadIcon aria-hidden="true" />
          Télécharger le modèle
        </a>
      </div>
      <details className="rounded-lg border bg-card p-4">
        <summary className="cursor-pointer text-base font-medium">Colonnes attendues</summary>
        <ul className="mt-3 grid gap-1 text-sm sm:grid-cols-2">
          {IMPORT_COLUMNS.map((column) => (
            <li key={column.key}>
              <code className="rounded bg-muted px-1">{column.label}</code>
              {column.required ? (
                <span className="text-destructive"> *</span>
              ) : (
                <span className="text-muted-foreground"> (facultatif)</span>
              )}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-muted-foreground">
          Le secteur doit correspondre à l'un de vos secteurs (nom exact), la région à l'une des
          régions du Québec. Les offres et les besoins sont séparés par « | ».
        </p>
      </details>
      <ImportWizard eventId={event.id} />
    </div>
  );
}
