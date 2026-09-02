import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SearchIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FormAlert } from "@/components/shared/form-field";
import { RegistrantMatchesCard } from "@/components/admin/matching/registrant-matches";
import { RunMatchingButton } from "@/components/admin/matching/run-matching-button";
import { RuleSetForm } from "@/components/admin/settings/rule-set-form";
import { requireOrganizer } from "@/lib/auth/session";
import { formatDate } from "@/lib/dates";
import { prisma } from "@/lib/db/prisma";
import { updateRuleSet } from "@/server/actions/rules";
import {
  getMatchingOverview,
  listEligibleRegistrants,
  listRegistrantsWithMatches,
} from "@/server/queries/matching";

export const metadata: Metadata = { title: "Matching" };

export default async function MatchingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { id } = await params;
  const { organization } = await requireOrganizer();
  const { q = "", page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const event = await prisma.event.findFirst({ where: { id, organizationId: organization.id } });
  if (!event) notFound();

  const overview = await getMatchingOverview(event.id, organization.id);
  const [ruleSet, list, eligible] = await Promise.all([
    overview.ruleSetId
      ? prisma.matchingRuleSet.findUnique({ where: { id: overview.ruleSetId } })
      : null,
    listRegistrantsWithMatches(event.id, { q: q.trim() || undefined, page }),
    listEligibleRegistrants(event.id),
  ]);
  const base = `/admin/events/${event.id}/matching`;
  const hasMatches = overview.totalMatches > 0 || overview.excluded > 0;

  return (
    <div className="space-y-8">
      <section className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader>
            <CardDescription>Inscrits éligibles</CardDescription>
            <CardTitle className="text-3xl tabular-nums">{overview.eligible}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {overview.ignored.length
              ? `${overview.ignored.length} ignoré${overview.ignored.length > 1 ? "s" : ""} (sans secteur)`
              : "Tous ont un secteur"}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Jumelages</CardDescription>
            <CardTitle className="text-3xl tabular-nums">{overview.totalMatches}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {overview.totalMatches
              ? `Score moyen ${overview.averageScore} · ${overview.pinned} épinglé${overview.pinned > 1 ? "s" : ""} · ${overview.excluded} exclu${overview.excluded > 1 ? "s" : ""}`
              : "Aucun calcul pour l'instant"}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Jeu de règles</CardDescription>
            <CardTitle className="truncate text-xl">{overview.ruleSetName}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <Link href="/admin/settings/regles" className="underline underline-offset-4">
              Gérer les jeux de règles
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Dernier calcul</CardDescription>
            <CardTitle className="text-xl">
              {overview.lastRun
                ? formatDate(overview.lastRun, organization.timezone, "short")
                : "Jamais"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <RunMatchingButton
              eventId={event.id}
              hasMatches={hasMatches}
              disabled={overview.eligible < 2}
            />
          </CardContent>
        </Card>
      </section>

      {overview.fewMatches.length ? (
        <FormAlert
          variant="info"
          message={`${overview.fewMatches.length} participant${overview.fewMatches.length > 1 ? "s ont" : " a"} moins de 2 jumelages : ${overview.fewMatches
            .slice(0, 8)
            .map((p) => p.name)
            .join(
              ", ",
            )}${overview.fewMatches.length > 8 ? "…" : ""}. Vous pouvez leur épingler un jumelage manuellement.`}
        />
      ) : null}
      {overview.ignored.length ? (
        <FormAlert
          variant="info"
          message={`Sans secteur, donc ignorés par le matching : ${overview.ignored
            .slice(0, 8)
            .map((p) => p.name)
            .join(
              ", ",
            )}${overview.ignored.length > 8 ? "…" : ""}. Complétez leur profil dans l'onglet Inscrits.`}
        />
      ) : null}

      <section className="grid gap-8 lg:grid-cols-[360px_1fr]">
        <aside className="space-y-3 rounded-lg border bg-card p-4">
          <h2 className="text-lg font-semibold">Pondérations</h2>
          {ruleSet ? (
            <RuleSetForm
              action={updateRuleSet.bind(null, ruleSet.id)}
              initial={{
                weightComplementarity: ruleSet.weightComplementarity,
                weightSectorAffinity: ruleSet.weightSectorAffinity,
                weightRegion: ruleSet.weightRegion,
                weightNovelty: ruleSet.weightNovelty,
                penaltySameSector: ruleSet.penaltySameSector,
                excludeSameCompany: ruleSet.excludeSameCompany,
                minScoreToPropose: ruleSet.minScoreToPropose,
              }}
              submitLabel="Enregistrer les règles"
              note={`Ces règles appartiennent à l'organisation (jeu « ${ruleSet.name} »). Après un changement, cliquez sur « Recalculer le matching ».`}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              Aucun jeu de règles : les valeurs par défaut sont utilisées.{" "}
              <Link href="/admin/settings/regles" className="underline underline-offset-4">
                Créer un jeu de règles
              </Link>
              .
            </p>
          )}
        </aside>

        <div className="space-y-4">
          <form method="get" className="flex gap-2">
            <div className="relative flex-1">
              <SearchIcon
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                name="q"
                defaultValue={q}
                placeholder="Rechercher un inscrit ou une entreprise…"
                aria-label="Rechercher"
                className="h-10 pl-9"
              />
            </div>
          </form>
          {list.rows.length === 0 ? (
            <p className="rounded-lg border border-dashed p-6 text-center text-base text-muted-foreground">
              Aucun inscrit ne correspond.
            </p>
          ) : (
            <div className="space-y-4">
              {list.rows.map((row) => (
                <RegistrantMatchesCard
                  key={row.person.registrationId}
                  eventId={event.id}
                  row={row}
                  eligible={eligible}
                />
              ))}
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
            <span>
              {list.total} inscrit{list.total > 1 ? "s" : ""} · page {page} sur {list.pageCount}
            </span>
            <div className="flex gap-2">
              {page > 1 ? (
                <Link
                  href={`${base}?q=${encodeURIComponent(q)}&page=${page - 1}`}
                  className="rounded-lg border px-3 py-2 hover:bg-muted"
                >
                  Précédent
                </Link>
              ) : null}
              {page < list.pageCount ? (
                <Link
                  href={`${base}?q=${encodeURIComponent(q)}&page=${page + 1}`}
                  className="rounded-lg border px-3 py-2 hover:bg-muted"
                >
                  Suivant
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
