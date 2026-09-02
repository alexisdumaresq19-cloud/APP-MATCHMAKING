import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DownloadIcon, PrinterIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { AutoSeatButton } from "@/components/admin/tables/auto-seat-button";
import { SeatingBoard } from "@/components/admin/tables/seating-board";
import { TableSetupForm } from "@/components/admin/tables/table-setup-form";
import { EmptyState } from "@/components/shared/empty-state";
import { FormAlert } from "@/components/shared/form-field";
import { StatCard } from "@/components/shared/stat-card";
import { requireOrganizer } from "@/lib/auth/session";
import { formatDate } from "@/lib/dates";
import { roundLabel } from "@/lib/rounds";
import { getSeatingPlan } from "@/server/queries/tables";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Tables" };

export default async function TablesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ronde?: string }>;
}) {
  const { id } = await params;
  const { ronde } = await searchParams;
  const { organization } = await requireOrganizer();
  const plan = await getSeatingPlan(id, organization.id);
  if (!plan) notFound();

  const roundNumber = Math.min(Math.max(1, Number(ronde) || 1), plan.event.roundCount);
  const round = plan.rounds[roundNumber - 1];
  const hasSeats = plan.rounds.some((r) => r.seated > 0);
  const base = `/admin/events/${id}/tables`;
  const missingSeats = Math.max(0, plan.totalActive - plan.totalSeats);

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-3">
        <StatCard
          icon="users"
          label="À placer"
          value={plan.totalActive}
          hint={`${plan.totalSeats} place${plan.totalSeats > 1 ? "s" : ""} au total`}
        />
        <StatCard
          icon="armchair"
          label={roundLabel(round.round, plan.event.roundCount)}
          value={round.seated}
          hint={
            round.unplaced.length
              ? `${round.unplaced.length} sans place`
              : round.seated
                ? "Tout le monde est placé"
                : "Aucune place attribuée"
          }
        />
        <StatCard
          icon="sparkles"
          label="Placement"
          value={<span>{hasSeats ? "Prêt" : "À faire"}</span>}
        >
          <AutoSeatButton eventId={id} hasSeats={hasSeats} disabled={plan.totalActive === 0} />
        </StatCard>
      </section>

      {missingSeats > 0 ? (
        <FormAlert
          variant="info"
          message={`Il manque ${missingSeats} place${missingSeats > 1 ? "s" : ""} : ajoutez des tables ou des sièges dans la configuration.`}
        />
      ) : null}
      {!plan.hasMatches ? (
        <FormAlert
          variant="info"
          message="Aucun jumelage calculé : le placement répartira les gens sans tenir compte des affinités. Lancez d'abord le matching pour un meilleur plan."
        />
      ) : null}

      <TableSetupForm
        eventId={id}
        initial={{
          tableCount: plan.event.tableCount,
          seatsPerTable: plan.event.seatsPerTable,
          roundCount: plan.event.roundCount,
          roundMinutes: plan.event.roundMinutes,
        }}
        tables={plan.tables}
        hasSeats={hasSeats}
        defaultOpen={!hasSeats && plan.totalActive === 0}
      />

      <div className="flex flex-wrap items-center gap-2">
        {plan.event.roundCount > 1 ? (
          <nav aria-label="Rondes" className="flex flex-wrap gap-1">
            {plan.rounds.map((r) => (
              <Link
                key={r.round}
                href={`${base}?ronde=${r.round}`}
                aria-current={r.round === roundNumber ? "page" : undefined}
                className={cn(
                  buttonVariants({
                    variant: r.round === roundNumber ? "default" : "outline",
                    size: "sm",
                  }),
                  "min-h-9",
                )}
              >
                Ronde {r.round} · {formatDate(r.startsAt, organization.timezone, "time")}
              </Link>
            ))}
          </nav>
        ) : null}
        <div className="ml-auto flex flex-wrap gap-2">
          <a
            href={`${base}/export.xlsx`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <DownloadIcon aria-hidden="true" />
            Excel
          </a>
          <Link
            href={`${base}/imprimer`}
            target="_blank"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <PrinterIcon aria-hidden="true" />
            Imprimer
          </Link>
        </div>
      </div>

      {plan.totalActive === 0 ? (
        <EmptyState
          icon="users"
          title="Aucun inscrit à placer"
          description="Les inscrits actifs apparaîtront ici dès qu'ils s'inscriront."
        />
      ) : (
        <SeatingBoard
          key={`${roundNumber}-${round.seated}-${round.unplaced.length}`}
          eventId={id}
          round={round}
          forbidSameSector={plan.forbidSameSector}
        />
      )}
      <p className="text-sm text-muted-foreground">
        Glissez une personne vers une autre table (ou touchez-la, puis utilisez les flèches et la
        barre d'espace). Une place déplacée à la main est verrouillée : le placement automatique ne
        la touchera plus. Le chiffre de chaque table est le score moyen des jumelages qui s'y
        trouvent.
      </p>
    </div>
  );
}
