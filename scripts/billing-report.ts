/* Billing report (section 9): one CSV line per completed event of a month.
 * Run: pnpm billing:report --month 2026-10   (defaults to the current month)
 * The figures come from the immutable BillingSnapshot rows, never recomputed.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function monthArg(): { year: number; month: number } {
  const index = process.argv.indexOf("--month");
  const raw = index !== -1 ? process.argv[index + 1] : undefined;
  const now = new Date();
  if (!raw) return { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 };
  const match = /^(\d{4})-(\d{2})$/.exec(raw);
  if (!match) {
    console.error("Usage: pnpm billing:report --month AAAA-MM");
    process.exit(1);
  }
  return { year: Number(match[1]), month: Number(match[2]) };
}

function csvCell(value: string | number | null | undefined): string {
  const text = value === null || value === undefined ? "" : String(value);
  return /[";\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

async function main() {
  const { year, month } = monthArg();
  const from = new Date(Date.UTC(year, month - 1, 1));
  const to = new Date(Date.UTC(year, month, 1));
  const snapshots = await prisma.billingSnapshot.findMany({
    where: { computedAt: { gte: from, lt: to } },
    include: { organization: { select: { name: true, slug: true } } },
    orderBy: { computedAt: "asc" },
  });
  const events = await prisma.event.findMany({
    where: { id: { in: snapshots.map((s) => s.eventId) } },
    select: { id: true, name: true, startsAt: true },
  });
  const eventOf = new Map(events.map((e) => [e.id, e]));

  const header = [
    "organisation",
    "slug",
    "evenement",
    "date_evenement",
    "inscrits",
    "presents",
    "source_plateforme",
    "source_manuelle",
    "releve_le",
  ];
  const lines = [header.join(";")];
  for (const snapshot of snapshots) {
    const event = eventOf.get(snapshot.eventId);
    lines.push(
      [
        snapshot.organization.name,
        snapshot.organization.slug,
        event?.name ?? snapshot.eventId,
        event ? event.startsAt.toISOString().slice(0, 10) : "",
        snapshot.totalRegistered,
        snapshot.totalCheckedIn,
        snapshot.totalPlatformSource,
        snapshot.totalManualSource,
        snapshot.computedAt.toISOString(),
      ]
        .map(csvCell)
        .join(";"),
    );
  }
  const totals = snapshots.reduce(
    (sum, s) => ({
      registered: sum.registered + s.totalRegistered,
      checkedIn: sum.checkedIn + s.totalCheckedIn,
    }),
    { registered: 0, checkedIn: 0 },
  );
  lines.push(
    [
      "TOTAL",
      "",
      `${snapshots.length} événement(s)`,
      "",
      totals.registered,
      totals.checkedIn,
      "",
      "",
      "",
    ]
      .map(csvCell)
      .join(";"),
  );
  process.stdout.write(`﻿${lines.join("\n")}\n`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
