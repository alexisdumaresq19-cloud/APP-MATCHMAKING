import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { render } from "@react-email/render";
import { PublishPanel } from "@/components/admin/publication/publish-panel";
import { FormAlert } from "@/components/shared/form-field";
import { StatCard } from "@/components/shared/stat-card";
import { requireOrganizer } from "@/lib/auth/session";
import { formatDate, formatDateRange } from "@/lib/dates";
import { prisma } from "@/lib/db/prisma";
import { emailBrandOf } from "@/lib/email/brand";
import { MatchesPublishedEmail } from "@/lib/email/templates/matches-published";
import { roundStartsAt } from "@/lib/rounds";
import { getPublicationOverview } from "@/server/services/publication";

export const metadata: Metadata = { title: "Publication" };

export default async function PublicationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { organization } = await requireOrganizer();
  const event = await prisma.event.findFirst({ where: { id, organizationId: organization.id } });
  if (!event) notFound();
  const overview = await getPublicationOverview(id, organization.id);

  // A representative preview: the first registrant's real matches, so the organizer sees the tone.
  const sample = await prisma.match.findFirst({
    where: { eventId: id, status: { not: "EXCLUDED" } },
    include: { a: { include: { participant: { include: { sector: true } } } } },
    orderBy: { score: "desc" },
  });
  const previewHtml = await render(
    <MatchesPublishedEmail
      brand={emailBrandOf(organization)}
      firstName={sample?.a.participant.firstName ?? "Marie"}
      eventName={event.name}
      eventDate={formatDateRange(event.startsAt, event.endsAt, organization.timezone)}
      venue={[event.venueName, event.venueAddress].filter(Boolean).join(", ") || null}
      matches={[
        {
          name: "Exemple : Pierre Tremblay",
          company: "Pro-Nettoyage inc.",
          sector: "Entretien ménager et commercial",
          sentences: [
            "Ils offrent « entretien ménager », que vous recherchez.",
            "Vos secteurs sont très complémentaires.",
            "Vous êtes dans la même région.",
          ],
        },
      ]}
      seats={Array.from({ length: event.roundCount }, (_, i) => ({
        round: i + 1,
        time: formatDate(roundStartsAt(event, i + 1), organization.timezone, "time"),
        table: `Table ${i + 3}`,
      }))}
      roundCount={event.roundCount}
      participantUrl="https://exemple.quebec/p/votre-lien-personnel"
      isUpdate={false}
    />,
  );

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon="handshake"
          label="Jumelages"
          value={overview.totalMatches}
          hint={
            overview.publishedAt
              ? `Publiés le ${formatDate(overview.publishedAt, organization.timezone, "short")}`
              : "Pas encore publiés"
          }
        />
        <StatCard
          icon="armchair"
          label="Placés à une table"
          value={overview.seated}
          hint={`sur ${overview.active} inscrit${overview.active > 1 ? "s" : ""} actif${overview.active > 1 ? "s" : ""}`}
        />
        <StatCard
          icon="send"
          label="À envoyer"
          value={overview.pending}
          hint={`${overview.upToDate} déjà à jour · ${overview.noConsent} sans consentement`}
        />
        <StatCard
          icon="mail-check"
          label="Courriels envoyés"
          value={overview.emails.sent}
          hint={
            overview.emails.failed
              ? `${overview.emails.failed} échec${overview.emails.failed > 1 ? "s" : ""}`
              : overview.reminders.sent
                ? `${overview.reminders.sent} rappel${overview.reminders.sent > 1 ? "s" : ""} envoyé${overview.reminders.sent > 1 ? "s" : ""}`
                : "Aucun échec"
          }
        />
      </section>

      {overview.totalMatches === 0 ? (
        <FormAlert
          variant="info"
          message="Aucun jumelage à publier pour l'instant. Lancez le matching, placez les tables, puis revenez ici."
        />
      ) : overview.seated === 0 ? (
        <FormAlert
          variant="info"
          message="Les tables ne sont pas encore attribuées : les courriels partiront sans numéro de table. Vous pourrez republier ensuite, seuls les inscrits concernés recevront la mise à jour."
        />
      ) : null}

      <PublishPanel eventId={id} overview={overview} />

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Aperçu du courriel</h2>
          <Link
            href="/admin/courriels"
            className="text-sm text-muted-foreground underline-offset-4 hover:underline"
          >
            Voir les courriels envoyés
          </Link>
        </div>
        <p className="text-sm text-muted-foreground">
          Chaque participant reçoit ses propres jumelages (jusqu'à {event.matchesPerParticipant}),
          expliqués en français, sa table par ronde et son lien personnel. Voici la mise en page,
          avec un exemple.
        </p>
        <iframe
          title="Aperçu du courriel « Vos jumelages sont prêts »"
          srcDoc={previewHtml}
          sandbox=""
          className="h-[720px] w-full rounded-lg border bg-white"
        />
      </section>
    </div>
  );
}
