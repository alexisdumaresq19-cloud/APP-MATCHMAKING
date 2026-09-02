import type { Metadata } from "next";
import { SectorsManager } from "@/components/admin/settings/sectors-manager";
import { requireOrganizer } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export const metadata: Metadata = { title: "Secteurs" };

export default async function SectorsPage() {
  const { organization } = await requireOrganizer();
  const sectors = await prisma.sector.findMany({
    where: { organizationId: organization.id },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { participants: true } } },
  });
  return (
    <SectorsManager
      sectors={sectors.map((s) => ({
        id: s.id,
        name: s.name,
        isActive: s.isActive,
        participants: s._count.participants,
      }))}
    />
  );
}
