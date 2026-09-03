/* Runs the retention job by hand (P2-S3, D-39): notices, then anonymization after 30 days.
 * Usage: pnpm retention
 * The same logic runs weekly on Vercel through /api/cron/retention (vercel.json).
 */
import { runRetention } from "../src/server/services/retention";
import { prisma } from "../src/lib/db/prisma";

runRetention()
  .then((run) => {
    console.log(
      `Organisations : ${run.organizations} · avis envoyés : ${run.noticed} · profils anonymisés : ${run.anonymized}`,
    );
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
