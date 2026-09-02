/* Seeds the demo organization on an empty database (first deployment), unless SEED_DEMO=false.
 * Used by `vercel-build` so a fresh hosted database is usable right after the first deployment.
 * Never touches a database that already has an organization.
 */
import { execSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";

const flag = (process.env.SEED_DEMO ?? "").trim().toLowerCase();
const disabled = ["false", "0", "no", "non"].includes(flag);

async function main() {
  if (disabled) {
    console.log("SEED_DEMO=false : la démonstration n'est pas chargée.");
    return;
  }
  const prisma = new PrismaClient();
  let organizations = 0;
  try {
    organizations = await prisma.organization.count();
  } finally {
    await prisma.$disconnect();
  }
  if (organizations > 0) {
    console.log(
      `Base déjà initialisée (${organizations} organisation(s)) : pas de démonstration chargée.`,
    );
    return;
  }
  console.log("Base vide : chargement de l'organisation de démonstration…");
  execSync("pnpm exec tsx prisma/seed.ts", { stdio: "inherit", env: process.env });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
