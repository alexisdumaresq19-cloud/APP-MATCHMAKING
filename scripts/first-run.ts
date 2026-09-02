/* One-command local setup: writes .env (with generated secrets), applies migrations and seeds the demo.
 * Usage:
 *   pnpm first-run                                   # local PostgreSQL (postgres:postgres@localhost:5432)
 *   pnpm first-run --database-url "postgresql://…"   # hosted database (Neon, Supabase…)
 *   pnpm first-run --skip-seed
 */
import { execSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    "database-url": { type: "string" },
    "direct-url": { type: "string" },
    "skip-seed": { type: "boolean", default: false },
    force: { type: "boolean", default: false },
  },
});

const DEFAULT_DB = "postgresql://postgres:postgres@localhost:5432/matchmaking_dev?schema=public";

function run(command: string) {
  console.log(`\n$ ${command}`);
  execSync(command, { stdio: "inherit", env: process.env });
}

function main() {
  const envPath = ".env";
  if (existsSync(envPath) && !values.force) {
    console.log(
      "Un fichier .env existe déjà : je le conserve (utilisez --force pour le régénérer).",
    );
  } else {
    const databaseUrl = values["database-url"] ?? DEFAULT_DB;
    const directUrl = values["direct-url"] ?? databaseUrl;
    const env = `# Généré par pnpm first-run le ${new Date().toISOString()}
DATABASE_URL="${databaseUrl}"
DIRECT_URL="${directUrl}"
AUTH_SECRET="${randomBytes(32).toString("base64")}"
AUTH_URL="http://localhost:3000"
PARTICIPANT_TOKEN_SECRET="${randomBytes(32).toString("base64")}"
EMAIL_FROM="Jumelage <no-reply@localhost>"
APP_BASE_URL="http://localhost:3000"
LOG_LEVEL="info"
`;
    writeFileSync(envPath, env);
    console.log(
      `.env créé (base de données : ${databaseUrl.replace(/:\/\/([^:]+):[^@]+@/, "://$1:***@")}).`,
    );
  }

  // Load .env into this process so Prisma and the seed see it.
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = /^([A-Z_][A-Z0-9_]*)="?(.*?)"?$/.exec(line.trim());
    if (match && !line.trim().startsWith("#")) process.env[match[1]] ??= match[2];
  }

  run("pnpm exec prisma migrate deploy");
  run("pnpm exec prisma generate");
  if (!values["skip-seed"]) run("pnpm exec tsx prisma/seed.ts");

  console.log(`
Prêt! Lancez :  pnpm dev
  Page publique   : http://localhost:3000/e/demo/rencontres-affaires-printemps
  Organisatrice   : http://localhost:3000/admin/login  (owner@demo.local / Demo-1234!)
  Courriels de test (liens des participants) : http://localhost:3000/admin/courriels
`);
}

main();
