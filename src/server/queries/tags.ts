import { cache } from "react";
import { prisma } from "@/lib/db/prisma";
import { normalizeTag } from "@/lib/normalize";

/** Most used offer/need tags of an organization (display form of the first occurrence). */
export const getTagSuggestions = cache(
  async (organizationId: string, limit = 300): Promise<string[]> => {
    const participants = await prisma.participant.findMany({
      where: { organizationId, deletedAt: null },
      select: { offers: true, needs: true },
      take: 5000,
    });
    const counts = new Map<string, { display: string; count: number }>();
    for (const participant of participants) {
      for (const tag of [...participant.offers, ...participant.needs]) {
        const key = normalizeTag(tag);
        if (!key) continue;
        const entry = counts.get(key);
        if (entry) entry.count += 1;
        else counts.set(key, { display: tag, count: 1 });
      }
    }
    return [...counts.values()]
      .sort((a, b) => b.count - a.count || a.display.localeCompare(b.display, "fr"))
      .slice(0, limit)
      .map((entry) => entry.display);
  },
);
