import { cache } from "react";
import { redirect } from "next/navigation";
import type { Organization, Organizer } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { ForbiddenError } from "@/lib/errors";
import { auth } from "./index";

export type OrganizerContext = {
  organizer: Organizer;
  organization: Organization;
};

/**
 * Loads the signed-in organizer and verifies against the database that the account is still
 * active and that the session has not been revoked (`sessionVersion`). Cached per request.
 */
export const getOrganizerContext = cache(async (): Promise<OrganizerContext | null> => {
  const session = await auth();
  const user = session?.user;
  if (!user?.id || !user.organizationId) return null;
  const organizer = await prisma.organizer.findUnique({
    where: { id: user.id },
    include: { organization: true },
  });
  if (!organizer || !organizer.isActive) return null;
  if (organizer.sessionVersion !== user.sessionVersion) return null;
  if (organizer.organizationId !== user.organizationId) return null;
  const { organization, ...rest } = organizer;
  return { organizer: rest, organization };
});

/** For pages: redirects to the login page when there is no valid session. */
export async function requireOrganizer(): Promise<OrganizerContext> {
  const context = await getOrganizerContext();
  if (!context) redirect("/admin/login?raison=session");
  return context;
}

/** For server actions: throws instead of redirecting. */
export async function requireOrganizerAction(): Promise<OrganizerContext> {
  const context = await getOrganizerContext();
  if (!context) throw new ForbiddenError("Votre session a expiré. Veuillez vous reconnecter.");
  return context;
}

export async function requireOwner(): Promise<OrganizerContext> {
  const context = await requireOrganizer();
  if (context.organizer.role !== "OWNER") redirect("/admin?erreur=proprietaire");
  return context;
}
