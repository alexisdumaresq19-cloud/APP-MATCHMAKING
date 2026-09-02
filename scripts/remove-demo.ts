/* Deletes the demonstration organization ("demo") before go-live (S4-10).
 * Usage: pnpm remove-demo [--yes]
 * Everything under the organization (events, participants, emails, audit log) goes with it
 * through the cascading relations. Refuses to run without --yes so it cannot be run by accident.
 */
import { parseArgs } from "node:util";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const { values } = parseArgs({ options: { yes: { type: "boolean", default: false } } });
  const demo = await prisma.organization.findUnique({
    where: { slug: "demo" },
    include: { _count: { select: { events: true, participants: true, organizers: true } } },
  });
  if (!demo) {
    console.log("Aucune organisation « demo » : rien à faire.");
    return;
  }
  console.log(
    `Organisation « ${demo.name} » : ${demo._count.events} événement(s), ${demo._count.participants} participant(s), ${demo._count.organizers} compte(s).`,
  );
  if (!values.yes) {
    console.log("Relancez avec --yes pour la supprimer définitivement.");
    process.exitCode = 1;
    return;
  }
  await prisma.organization.delete({ where: { id: demo.id } });
  console.log("Organisation de démonstration supprimée.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
