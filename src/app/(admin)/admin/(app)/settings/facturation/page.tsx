import type { Metadata } from "next";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { StatCard } from "@/components/shared/stat-card";
import { requireOrganizer } from "@/lib/auth/session";
import { formatDate } from "@/lib/dates";
import { listBillingRows } from "@/server/queries/participants";

export const metadata: Metadata = { title: "Facturation" };

/** Read-only: the frozen billing snapshots, one per completed event (S4-04, section 9). */
export default async function BillingSettingsPage() {
  const { organization } = await requireOrganizer();
  const rows = await listBillingRows(organization.id);
  const totals = rows.reduce(
    (sum, row) => ({
      registered: sum.registered + row.totalRegistered,
      checkedIn: sum.checkedIn + row.totalCheckedIn,
    }),
    { registered: 0, checkedIn: 0 },
  );
  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-3">
        <StatCard icon="trophy" label="Événements terminés" value={rows.length} />
        <StatCard
          icon="users"
          label="Inscrits facturables"
          value={totals.registered}
          hint="Toutes sources, annulations exclues"
        />
        <StatCard icon="circle-check" label="Présences" value={totals.checkedIn} />
      </section>
      <p className="text-sm text-muted-foreground">
        Chaque relevé est figé au moment où vous terminez l'événement (onglet Jour J) et ne change
        plus, même si des inscriptions sont modifiées ensuite. AD Création facture à partir de ces
        chiffres; les relevés mensuels sont produits par AD Création.
      </p>
      {rows.length === 0 ? (
        <EmptyState
          icon="file-spreadsheet"
          title="Aucun relevé pour l'instant"
          description="Le premier relevé apparaîtra quand vous terminerez un événement."
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Événement</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Inscrits</TableHead>
                <TableHead className="text-right">Présents</TableHead>
                <TableHead className="text-right">En ligne</TableHead>
                <TableHead className="text-right">Manuels / importés</TableHead>
                <TableHead>Relevé figé le</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">
                    {row.event ? (
                      <Link
                        href={`/admin/events/${row.event.id}/jour-j`}
                        className="hover:underline"
                      >
                        {row.event.name}
                      </Link>
                    ) : (
                      "Événement supprimé"
                    )}
                  </TableCell>
                  <TableCell>
                    {row.event
                      ? formatDate(row.event.startsAt, organization.timezone, "date")
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{row.totalRegistered}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.totalCheckedIn}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.totalPlatformSource}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{row.totalManualSource}</TableCell>
                  <TableCell>
                    {formatDate(row.computedAt, organization.timezone, "short")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
