/* Build step for Vercel: resolves the database variables injected by the Neon/Postgres integration,
 * applies migrations, seeds the demo once (SEED_DEMO=true), then builds the app.
 */
import { execSync } from "node:child_process";
import { applyDatabaseUrlsToEnv } from "../src/lib/db/database-url";

applyDatabaseUrlsToEnv();
if (!process.env.DATABASE_URL) {
  console.error(
    "Aucune base de données : ajoutez une base Neon/Postgres dans l'onglet Storage de Vercel ou définissez DATABASE_URL.",
  );
  process.exit(1);
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
