import type { Metadata } from "next";
import { RuleSetsManager } from "@/components/admin/settings/rule-sets-manager";
import { requireOrganizer } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export const metadata: Metadata = { title: "Règles de matching" };

export default async function RulesPage({
  searchParams,
}: {
  searchParams: Promise<{ jeu?: string }>;
}) {
  const { organization } = await requireOrganizer();
  const { jeu } = await searchParams;
  const ruleSets = await prisma.matchingRuleSet.findMany({
    where: { organizationId: organization.id },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    include: { _count: { select: { events: true } } },
  });
  const selected = ruleSets.find((r) => r.id === jeu) ?? ruleSets[0] ?? null;
  return (
    <RuleSetsManager
      ruleSets={ruleSets.map((r) => ({
        id: r.id,
        name: r.name,
        isDefault: r.isDefault,
        events: r._count.events,
      }))}
      selected={
        selected
          ? {
              id: selected.id,
              name: selected.name,
              isDefault: selected.isDefault,
              values: {
                weightComplementarity: selected.weightComplementarity,
                weightSectorAffinity: selected.weightSectorAffinity,
                weightRegion: selected.weightRegion,
                weightNovelty: selected.weightNovelty,
                penaltySameSector: selected.penaltySameSector,
                excludeSameCompany: selected.excludeSameCompany,
                minScoreToPropose: selected.minScoreToPropose,
              },
            }
          : null
      }
    />
  );
}
