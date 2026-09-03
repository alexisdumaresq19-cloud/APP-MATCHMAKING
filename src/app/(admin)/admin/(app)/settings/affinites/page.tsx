import type { Metadata } from "next";
import { AffinityMatrix } from "@/components/admin/settings/affinity-matrix";
import { AffinitySuggestions } from "@/components/admin/settings/affinity-suggestions";
import { affinitySuggestions } from "@/server/services/learning";
import { requireOrganizer } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export const metadata: Metadata = { title: "Matrice d'affinité" };

export default async function AffinitiesPage() {
  const { organization } = await requireOrganizer();
  const [sectors, rows, suggestions] = await Promise.all([
    prisma.sector.findMany({
      where: { organizationId: organization.id, isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
    prisma.sectorAffinity.findMany({
      where: { organizationId: organization.id },
      select: { fromSectorId: true, toSectorId: true, score: true },
    }),
    affinitySuggestions(organization.id),
  ]);
  const values: Record<string, number> = {};
  for (const row of rows) {
    const key =
      row.fromSectorId < row.toSectorId
        ? `${row.fromSectorId}|${row.toSectorId}`
        : `${row.toSectorId}|${row.fromSectorId}`;
    values[key] = row.score;
  }
  return (
    <div className="space-y-6">
      <AffinitySuggestions suggestions={suggestions} />
      <AffinityMatrix sectors={sectors} initialValues={values} />
    </div>
  );
}
