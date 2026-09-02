import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { rateLimit } from "@/lib/rate-limit";

const key = `test:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;

afterAll(async () => {
  await prisma.rateLimit.deleteMany({ where: { key: { startsWith: "test:" } } });
  await prisma.$disconnect();
});

describe("database rate limit", () => {
  it("allows up to `limit` calls per window, then blocks", async () => {
    const results = [];
    for (let i = 0; i < 4; i += 1)
      results.push(await rateLimit(key, { limit: 3, windowSeconds: 60 }));
    expect(results.map((r) => r.ok)).toEqual([true, true, true, false]);
    expect(results[0].remaining).toBe(2);
    expect(results[3].remaining).toBe(0);
  });

  it("resets after the window elapses", async () => {
    await prisma.rateLimit.update({
      where: { key },
      data: { windowStart: new Date(Date.now() - 120_000) },
    });
    const result = await rateLimit(key, { limit: 3, windowSeconds: 60 });
    expect(result.ok).toBe(true);
    expect(result.remaining).toBe(2);
  });
});
