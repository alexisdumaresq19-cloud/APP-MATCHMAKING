import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/admin/tables/print-button";
import { requireOrganizer } from "@/lib/auth/session";
import { formatDate, formatDateRange } from "@/lib/dates";
import { prisma } from "@/lib/db/prisma";
import { roundLabel } from "@/lib/rounds";
import { getSeatingPlan } from "@/server/queries/tables";

export const metadata: Metadata = { title: "Plan de tables (impression)" };

/**
 * Printable table plan: one page per table and per round, large type, readable on a table tent
 * or taped at the entrance (S3-03). Uses the browser's print dialog (no PDF library).
 */
export default async function PrintTablesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { organization } = await requireOrganizer();
  const event = await prisma.event.findFirst({ where: { id, organizationId: organization.id } });
  if (!event) notFound();
  const plan = await getSeatingPlan(id, organization.id);
  if (!plan) notFound();
  const pages = plan.rounds.flatMap((round) =>
    round.tables.filter((table) => table.members.length > 0).map((table) => ({ round, table })),
  );

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Plan de tables</h1>
          <p className="text-sm text-muted-foreground">
            {pages.length} page{pages.length > 1 ? "s" : ""} (une par table et par ronde). Dans la
            boîte d'impression, choisissez « Enregistrer en PDF » pour obtenir un fichier.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/admin/events/${id}/tables`}
            className="inline-flex min-h-9 items-center rounded-lg border px-3 text-sm font-medium hover:bg-muted"
          >
            Retour
          </Link>
          <PrintButton />
        </div>
      </div>

      {pages.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-base text-muted-foreground">
          Aucune place attribuée. Lancez « Placer automatiquement » dans l'onglet Tables.
        </p>
      ) : null}

      {pages.map(({ round, table }) => (
        <article
          key={`${round.round}-${table.id}`}
          className="mb-8 break-after-page rounded-2xl border-2 p-8 print:mb-0 print:rounded-none print:border-0 print:p-0"
        >
          <header className="border-b-4 border-black pb-4 text-center">
            <p className="text-2xl font-medium">{event.name}</p>
            <p className="text-lg text-muted-foreground print:text-black">
              {formatDateRange(event.startsAt, event.endsAt, organization.timezone)}
            </p>
            <p className="mt-6 text-7xl font-black tracking-tight">{table.name}</p>
            {plan.event.roundCount > 1 ? (
              <p className="mt-2 text-3xl font-semibold">
                {roundLabel(round.round, plan.event.roundCount)} ·{" "}
                {formatDate(round.startsAt, organization.timezone, "time")}
              </p>
            ) : null}
          </header>
          <ol className="mt-6 space-y-4">
            {table.members.map((member) => (
              <li key={member.registrationId} className="leading-tight">
                <p className="text-3xl font-bold">{member.name}</p>
                <p className="text-xl text-muted-foreground print:text-black">
                  {member.company}
                  {member.sector ? ` · ${member.sector}` : ""}
                </p>
              </li>
            ))}
          </ol>
          <footer className="mt-10 text-center text-lg text-muted-foreground print:text-black">
            {organization.platformName} · {organization.name}
          </footer>
        </article>
      ))}
    </div>
  );
}
