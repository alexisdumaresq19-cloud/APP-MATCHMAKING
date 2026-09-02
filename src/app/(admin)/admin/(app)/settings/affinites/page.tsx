import type { Metadata } from "next";
import { AffinityMatrix } from "@/components/admin/settings/affinity-matrix";
import { requireOrganizer } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export const metadata: Metadata = { title: "Matrice d'affinité" };

export default async function AffinitiesPage() {
  const { organization } = await requireOrganizer();
  const [sectors, rows] = await Promise.all([
    prisma.sector.findMany({
      where: { organizationId: organization.id, isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
    prisma.sectorAffinity.findMany({
      where: { organizationId: organization.id },
      select: { fromSectorId: true, toSectorId: true, score: true },
    }),
  ]);
  const values: Record<string, number> = {};
  for (const row of rows) {
    const key =
      row.fromSectorId < row.toSectorId
        ? `${row.fromSectorId}|${row.toSectorId}`
        : `${row.toSectorId}|${row.fromSectorId}`;
    values[key] = row.score;
  }
  return <AffinityMatrix sectors={sectors} initialValues={values} />;
}
