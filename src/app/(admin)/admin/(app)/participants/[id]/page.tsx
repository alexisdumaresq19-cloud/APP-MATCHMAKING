import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon, DownloadIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AnonymizeButton } from "@/components/admin/participants/anonymize-button";
import { PageHeader } from "@/components/admin/page-header";
import { requireOrganizer } from "@/lib/auth/session";
import { formatDate } from "@/lib/dates";
import { registrationSourceLabel, registrationStatusLabel } from "@/lib/labels";
import { formatPhone } from "@/lib/normalize";
import { cn } from "@/lib/utils";
import { getParticipantProfile } from "@/server/queries/participants";
import { currentConsentVersion } from "@/server/services/consent";

export const metadata: Metadata = { title: "Fiche participant" };

const MATCH_STATUS: Record<string, { label: string; className: string }> = {
  PROPOSED: { label: "Proposé", className: "" },
  PINNED: { label: "Épinglé", className: "bg-green-100 text-green-900" },
  EXCLUDED: { label: "Exclu", className: "bg-muted text-muted-foreground" },
};

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

/** One participant across events (S4-06): identity, matching profile, history, consents. */
export default async function ParticipantPage({ params }: { params: Promise<{ id: string }> }) {
  const { organization } = await requireOrganizer();
  const { id } = await params;
  const profile = await getParticipantProfile(organization.id, id);
  if (!profile) notFound();
  const { participant, matches, soughtSectors } = profile;
  const tz = organization.timezone;
  const name = `${participant.firstName} ${participant.lastName}`;
  const anonymized = participant.deletedAt !== null;
  const pendingDeletion = participant.deletionRequests.some((r) => r.status === "PENDING");
  const consentOk = participant.consents.some(
    (c) => c.consentVersion === currentConsentVersion(organization),
  );
  const facts: { label: string; value: string | null }[] = [
    { label: "Courriel", value: participant.email },
    { label: "Téléphone", value: participant.phone ? formatPhone(participant.phone) : null },
    { label: "Poste", value: participant.jobTitle },
    { label: "Entreprise", value: participant.companyName },
    { label: "Secteur", value: participant.sector?.name ?? null },
    { label: "Site web", value: participant.website },
    { label: "Ville", value: participant.city },
    { label: "Région", value: participant.region },
    { label: "Profil créé le", value: formatDate(participant.createdAt, tz, "date") },
    { label: "Dernière mise à jour", value: formatDate(participant.updatedAt, tz, "short") },
  ];
  const eventsWithMatches = [...new Set(matches.map((m) => m.eventName))];

  return (
    <>
      <PageHeader
        eyebrow={
          <Link
            href="/admin/participants"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeftIcon className="size-4" aria-hidden="true" />
            Participants
          </Link>
        }
        title={name}
        description={
          <div className="flex flex-wrap items-center gap-2">
            <span>{participant.companyName}</span>
            {anonymized ? (
              <Badge variant="outline">
                Anonymisé le {formatDate(participant.deletedAt, tz, "date")}
              </Badge>
            ) : pendingDeletion ? (
              <Badge className="bg-amber-100 text-amber-900">Suppression demandée</Badge>
            ) : consentOk ? (
              <Badge className="bg-green-100 text-green-900">Consentement à jour</Badge>
            ) : (
              <Badge variant="secondary">Consentement en attente</Badge>
            )}
          </div>
        }
        actions={
          <>
            <a
              href={`/admin/participants/${participant.id}/export.json`}
              className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
            >
              <DownloadIcon aria-hidden="true" />
              Exporter (JSON)
            </a>
            {anonymized ? null : (
              <AnonymizeButton
                participantId={participant.id}
                name={name}
                email={participant.email}
              />
            )}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Coordonnées</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              {facts.map((fact) => (
                <div key={fact.label} className="contents">
                  <dt className="text-muted-foreground">{fact.label}</dt>
                  <dd className="min-w-0 break-words">{fact.value || "—"}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Profil de jumelage</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div>
              <h3 className="mb-1.5 font-medium">Ce que l&apos;entreprise offre</h3>
              <TagList items={participant.offers} empty="Aucune offre indiquée." />
            </div>
            <div>
              <h3 className="mb-1.5 font-medium">Ce qu&apos;elle recherche</h3>
              <TagList items={participant.needs} empty="Aucun besoin indiqué." />
            </div>
            <div>
              <h3 className="mb-1.5 font-medium">Avec qui elle veut collaborer</h3>
              <TagList items={soughtSectors} empty="Aucun secteur ciblé." />
            </div>
            <div>
              <h3 className="mb-1.5 font-medium">Description</h3>
              <p className="whitespace-pre-line text-muted-foreground">
                {participant.description || "Aucune description."}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <section className="mt-8 space-y-3">
        <h2 className="text-lg font-semibold">Inscriptions</h2>
        {participant.registrations.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune inscription.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Événement</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="hidden md:table-cell">Source</TableHead>
                  <TableHead className="hidden md:table-cell">Tables</TableHead>
                  <TableHead className="hidden lg:table-cell">Objectifs</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {participant.registrations.map((registration) => (
                  <TableRow key={registration.id}>
                    <TableCell>
                      <Link
                        href={`/admin/events/${registration.eventId}/inscrits`}
                        className="font-medium hover:underline"
                      >
                        {registration.event.name}
                      </Link>
                      <div className="text-xs text-muted-foreground">
                        {formatDate(registration.event.startsAt, tz, "date")}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {registrationStatusLabel(registration.status)}
                      </Badge>
                      {registration.checkedInAt ? (
                        <div className="mt-1 text-xs text-muted-foreground">
                          Arrivé à {formatDate(registration.checkedInAt, tz, "time")}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {registrationSourceLabel(registration.source)}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {registration.assignments.length === 0
                        ? "—"
                        : registration.assignments
                            .map(
                              (a) =>
                                `Tour ${a.round} : ${a.table.label ?? `Table ${a.table.number}`}`,
                            )
                            .join(" · ")}
                    </TableCell>
                    <TableCell className="hidden max-w-xs truncate lg:table-cell">
                      {registration.goalsText || "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-lg font-semibold">Jumelages ({matches.length})</h2>
        {matches.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucun jumelage calculé pour l&apos;instant.
          </p>
        ) : (
          eventsWithMatches.map((eventName) => (
            <div key={eventName} className="rounded-lg border bg-card p-4">
              <h3 className="mb-2 font-medium">{eventName}</h3>
              <ul className="divide-y">
                {matches
                  .filter((m) => m.eventName === eventName)
                  .map((match, index) => {
                    const status = MATCH_STATUS[match.status] ?? {
                      label: match.status,
                      className: "",
                    };
                    return (
                      <li
                        key={`${match.partner}-${index}`}
                        className="flex flex-wrap gap-2 py-2 text-sm"
                      >
                        <div className="min-w-48 flex-1">
                          <span className="font-medium">{match.partner}</span>
                          <span className="text-muted-foreground"> · {match.company}</span>
                          {match.sentences.length ? (
                            <ul className="mt-1 list-disc pl-4 text-muted-foreground">
                              {match.sentences.map((s) => (
                                <li key={s}>{s}</li>
                              ))}
                            </ul>
                          ) : null}
                        </div>
                        <div className="flex items-start gap-2">
                          <Badge variant="outline" className={status.className}>
                            {status.label}
                          </Badge>
                          <span className="text-muted-foreground tabular-nums">
                            {match.score} pts
                          </span>
                        </div>
                      </li>
                    );
                  })}
              </ul>
            </div>
          ))
        )}
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Consentements</h2>
          {participant.consents.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun consentement enregistré.</p>
          ) : (
            <ul className="divide-y rounded-lg border bg-card text-sm">
              {participant.consents.map((consent) => (
                <li key={consent.id} className="flex flex-wrap justify-between gap-2 px-4 py-2">
                  <span>{formatDate(consent.createdAt, tz, "short")}</span>
                  <span className="font-mono text-xs text-muted-foreground">
                    v. {consent.consentVersion.slice(0, 8)}
                    {consent.consentVersion === currentConsentVersion(organization)
                      ? " (actuelle)"
                      : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Demandes de suppression</h2>
          {participant.deletionRequests.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune demande.</p>
          ) : (
            <ul className="divide-y rounded-lg border bg-card text-sm">
              {participant.deletionRequests.map((request) => (
                <li key={request.id} className="space-y-1 px-4 py-2">
                  <div className="flex flex-wrap justify-between gap-2">
                    <span>Demandé le {formatDate(request.requestedAt, tz, "short")}</span>
                    <Badge variant="outline">
                      {request.status === "PENDING"
                        ? "À traiter"
                        : request.status === "COMPLETED"
                          ? "Anonymisé"
                          : "Refusée"}
                    </Badge>
                  </div>
                  {request.note ? (
                    <p className="text-muted-foreground">Note : {request.note}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          <Link
            href="/admin/participants/suppressions"
            className="text-sm text-brand underline-offset-4 hover:underline"
          >
            Voir la file des demandes
          </Link>
        </section>
      </div>
    </>
  );
}
