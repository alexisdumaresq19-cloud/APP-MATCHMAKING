/* Seeds the demo organization once, only when SEED_DEMO=true and it does not exist yet.
 * Used by `vercel-build` so a fresh hosted database is usable right after the first deployment.
 */
import { execSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";

async function main() {
  if (process.env.SEED_DEMO !== "true") {
    console.log("SEED_DEMO is not 'true': skipping demo seed.");
    return;
  }
  const prisma = new PrismaClient();
  try {
    const existing = await prisma.organization.findUnique({ where: { slug: "demo" } });
    if (existing) {
      console.log("Demo organization already present: skipping seed.");
      return;
    }
  } finally {
    await prisma.$disconnect();
  }
  execSync("pnpm exec tsx prisma/seed.ts", { stdio: "inherit", env: process.env });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
