import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { prisma } from "@/lib/db/prisma";
import { logger } from "@/lib/logger";

export type RateLimitOptions = { limit: number; windowSeconds: number };
export type RateLimitResult = { ok: boolean; remaining: number; resetAt: Date };

const upstashLimiters = new Map<string, Ratelimit>();

function upstashLimiter(options: RateLimitOptions): Ratelimit | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  const key = `${options.limit}:${options.windowSeconds}`;
  let limiter = upstashLimiters.get(key);
  if (!limiter) {
    limiter = new Ratelimit({
      redis: new Redis({ url, token }),
      limiter: Ratelimit.fixedWindow(options.limit, `${options.windowSeconds} s`),
      prefix: "mm:rl",
    });
    upstashLimiters.set(key, limiter);
  }
  return limiter;
}

async function databaseRateLimit(key: string, options: RateLimitOptions): Promise<RateLimitResult> {
  const rows = await prisma.$queryRaw<Array<{ count: number; windowStart: Date }>>`
    INSERT INTO "RateLimit" ("key", "count", "windowStart")
    VALUES (${key}, 1, NOW())
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE
        WHEN "RateLimit"."windowStart" <= NOW() - (${options.windowSeconds}::float8 * interval '1 second') THEN 1
        ELSE "RateLimit"."count" + 1
      END,
      "windowStart" = CASE
        WHEN "RateLimit"."windowStart" <= NOW() - (${options.windowSeconds}::float8 * interval '1 second') THEN NOW()
        ELSE "RateLimit"."windowStart"
      END
    RETURNING "count", "windowStart"
  `;
  const row = rows[0];
  const count = Number(row?.count ?? 1);
  const windowStart = row?.windowStart ?? new Date();
  const resetAt = new Date(windowStart.getTime() + options.windowSeconds * 1000);

  // Opportunistic cleanup of stale buckets (about 1 call in 100).
  if (Math.random() < 0.01) {
    prisma.rateLimit
      .deleteMany({ where: { windowStart: { lt: new Date(Date.now() - 24 * 3600 * 1000) } } })
      .catch((error) => logger.warn({ err: error }, "rate limit cleanup failed"));
  }

  return { ok: count <= options.limit, remaining: Math.max(0, options.limit - count), resetAt };
}

/**
 * Fixed-window rate limit. Uses Upstash when configured, otherwise the `RateLimit` table.
 * Fails open (allows the request) if the backing store is unavailable, and logs the error.
 */
export async function rateLimit(key: string, options: RateLimitOptions): Promise<RateLimitResult> {
  try {
    const upstash = upstashLimiter(options);
    if (upstash) {
      const result = await upstash.limit(key);
      return { ok: result.success, remaining: result.remaining, resetAt: new Date(result.reset) };
    }
    return await databaseRateLimit(key, options);
  } catch (error) {
    logger.error({ err: error, key }, "rate limit backend failure; allowing request");
    return { ok: true, remaining: options.limit, resetAt: new Date() };
  }
}

/** Best-effort client IP from proxy headers (Vercel sets x-forwarded-for). */
export function clientIpFromHeaders(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return headers.get("x-real-ip")?.trim() || "unknown";
}
