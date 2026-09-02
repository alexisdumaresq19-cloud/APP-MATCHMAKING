/* Build step for Vercel: checks the configuration, resolves the database variables injected by the
 * Neon/Postgres integration, applies migrations, seeds the demo once (SEED_DEMO=true), then builds.
 * When something is missing, the build log explains exactly what to add in the Vercel dashboard.
 */
import { execSync } from "node:child_process";
import { applyDatabaseUrlsToEnv } from "../src/lib/db/database-url";

applyDatabaseUrlsToEnv();

const problems: string[] = [];
if (!process.env.DATABASE_URL) {
  problems.push(
    "Base de données absente : dans le projet Vercel, onglet « Storage » → « Create Database » → Neon (Postgres) → « Connect ». Vercel ajoutera les variables de connexion lui-même.",
  );
}
for (const name of ["AUTH_SECRET", "PARTICIPANT_TOKEN_SECRET"]) {
  const value = process.env[name] ?? "";
  if (value.trim().length < 32) {
    console.warn(
      `Avertissement : ${name} n'est pas définie; un secret dérivé de la base de données sera utilisé. À définir avant la mise en production (Settings → Environment Variables).`,
    );
  }
}
if (problems.length) {
  console.error("\n========================================================");
  console.error("Configuration incomplète : le déploiement ne peut pas continuer.");
  for (const problem of problems) console.error(`\n• ${problem}`);
  console.error("\nEnsuite : onglet « Deployments » → « … » → « Redeploy ».");
  console.error("========================================================\n");
  process.exit(1);
}
if (process.env.SEED_DEMO !== "true") {
  console.log(
    "Info : SEED_DEMO n'est pas à « true », la démonstration ne sera pas chargée automatiquement.",
  );
}

for (const command of [
  "pnpm exec prisma migrate deploy",
  "pnpm exec prisma generate",
  "pnpm exec tsx scripts/ensure-demo.ts",
  "pnpm exec next build",
]) {
  console.log(`\n$ ${command}`);
  execSync(command, { stdio: "inherit", env: process.env });
}
