import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { DownloadIcon, FileSpreadsheetIcon, MailIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { DataRequestForm } from "@/components/participant/data-request-form";
import { resolveParticipantAccess } from "@/lib/auth/participant-session";
import { formatDate } from "@/lib/dates";
import { prisma } from "@/lib/db/prisma";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Mes données" };

/** Law 25 self-service (S4-05): what we hold, download it, ask for deletion. */
export default async function ParticipantDataPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const context = await resolveParticipantAccess(token);
  if (!context) notFound();
  const { participant, organization } = context;
  const [registrations, consents, matches, pendingRequest] = await Promise.all([
    prisma.eventRegistration.count({ where: { participantId: participant.id } }),
    prisma.consentLog.count({ where: { participantId: participant.id } }),
    prisma.match.count({
      where: {
        OR: [{ a: { participantId: participant.id } }, { b: { participantId: participant.id } }],
      },
    }),
    prisma.deletionRequest.findFirst({
      where: { participantId: participant.id, status: "PENDING" },
      orderBy: { requestedAt: "desc" },
    }),
  ]);
  const base = `/p/${token}/donnees`;
  const rows = [
    {
      label: "Profil",
      value: "Nom, coordonnées, entreprise, offres, besoins, secteurs recherchés",
    },
    { label: "Inscriptions", value: `${registrations} événement${registrations > 1 ? "s" : ""}` },
    { label: "Jumelages", value: `${matches} suggestion${matches > 1 ? "s" : ""} de rencontre` },
    {
      label: "Consentements",
      value: `${consents} acceptation${consents > 1 ? "s" : ""} de l'avis de confidentialité`,
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Mes données</h1>
        <p className="mt-1 text-base text-muted-foreground">
          Ce que {organization.name} conserve à votre sujet, et vos droits (Loi 25).
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Ce que nous conservons</h2>
        <dl className="divide-y rounded-lg border bg-card text-sm">
          {rows.map((row) => (
            <div key={row.label} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:gap-4">
              <dt className="w-40 shrink-0 font-medium">{row.label}</dt>
              <dd className="text-muted-foreground">{row.value}</dd>
            </div>
          ))}
        </dl>
        <p className="text-sm text-muted-foreground">
          Vos données servent uniquement au jumelage et à l&apos;organisation des événements. Elles
          ne sont jamais vendues. Questions : {organization.privacyEmail}.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Télécharger une copie</h2>
        <p className="text-sm text-muted-foreground">
          Le fichier contient votre profil, vos inscriptions, vos jumelages et vos consentements.
        </p>
        <div className="flex flex-wrap gap-2">
          <a href={`${base}/export.json`} className={cn(buttonVariants({ size: "lg" }))}>
            <DownloadIcon aria-hidden="true" />
            Télécharger (JSON)
          </a>
          <a
            href={`${base}/export.csv`}
            className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
          >
            <FileSpreadsheetIcon aria-hidden="true" />
            Télécharger (CSV)
          </a>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Invitations aux prochains événements</h2>
        <p className="text-sm text-muted-foreground">
          {participant.invitationsOptOut
            ? "Vous ne recevez plus d'invitations par courriel."
            : `${organization.name} peut vous inviter par courriel à ses prochains événements.`}
        </p>
        <Link
          href={`/p/${token}/invitations`}
          className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
        >
          <MailIcon aria-hidden="true" />
          {participant.invitationsOptOut
            ? "Recevoir à nouveau les invitations"
            : "Gérer mes invitations"}
        </Link>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Supprimer mes données</h2>
        <p className="text-sm text-muted-foreground">
          Vous pouvez demander l&apos;effacement de votre profil. Les inscriptions passées restent
          comptées, sans votre nom, aux fins de facturation.
        </p>
        <DataRequestForm
          token={token}
          pendingSince={
            pendingRequest
              ? formatDate(pendingRequest.requestedAt, organization.timezone, "date")
              : null
          }
          privacyEmail={organization.privacyEmail}
        />
      </section>
    </div>
  );
}
