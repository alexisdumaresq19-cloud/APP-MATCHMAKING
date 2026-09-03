import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { runRetention } from "@/server/services/retention";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Weekly retention job (vercel.json → Vercel Cron). Vercel sends `Authorization: Bearer CRON_SECRET`;
 * without the secret configured the route refuses to run rather than run unauthenticated.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET n'est pas configuré." }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }
  try {
    const run = await runRetention();
    logger.info(run, "retention run");
    return NextResponse.json({ ok: true, ...run });
  } catch (error) {
    logger.error({ err: error }, "retention run failed");
    return NextResponse.json({ error: "La purge a échoué." }, { status: 500 });
  }
}
