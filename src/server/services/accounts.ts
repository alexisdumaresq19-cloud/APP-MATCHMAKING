import type { Organization, Organizer, OrganizerRole } from "@prisma/client";
import { audit } from "@/lib/audit";
import { appBaseUrl } from "@/lib/auth/participant-session";
import { createOrganizerToken, TOKEN_TTL_MINUTES } from "@/lib/auth/organizer-token";
import { prisma } from "@/lib/db/prisma";
import { emailBrandOf } from "@/lib/email/brand";
import { sendEmail } from "@/lib/email/send";
import { OrganizerInviteEmail } from "@/lib/email/templates/organizer-invite";
import { AppError, NotFoundError } from "@/lib/errors";

type Actor = { organizerId: string; organizerName: string };

export type AccountRow = Pick<
  Organizer,
  "id" | "email" | "name" | "role" | "isActive" | "lastLoginAt" | "createdAt"
> & { invitationPending: boolean; isSelf: boolean };

export async function listAccounts(organizationId: string, selfId: string): Promise<AccountRow[]> {
  const organizers = await prisma.organizer.findMany({
    where: { organizationId },
    orderBy: [{ role: "asc" }, { name: "asc" }],
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      lastLoginAt: true,
      createdAt: true,
      passwordHash: true,
    },
  });
  return organizers.map(({ passwordHash, ...o }) => ({
    ...o,
    invitationPending: passwordHash === null,
    isSelf: o.id === selfId,
  }));
}

async function sendInvitation(
  organization: Organization,
  organizer: Organizer,
  invitedBy: string,
): Promise<boolean> {
  const { token } = await createOrganizerToken(organizer, "INVITE");
  const acceptUrl = `${appBaseUrl()}/admin/invitation?token=${encodeURIComponent(token)}`;
  return sendEmail({
    organization,
    to: organizer.email,
    subject: `Invitation : espace organisateur de ${organization.name}`,
    template: "organizer_invite",
    react: OrganizerInviteEmail({
      brand: emailBrandOf(organization),
      name: organizer.name,
      invitedBy,
      role: organizer.role,
      acceptUrl,
      expiresDays: Math.round(TOKEN_TTL_MINUTES.INVITE / (24 * 60)),
    }),
  });
}

/** Creates the account without a password and emails a 7-day activation link (S4-03). */
export async function inviteOrganizer(
  organizationId: string,
  input: { email: string; name: string; role: OrganizerRole },
  actor: Actor,
): Promise<{ organizer: Organizer; sent: boolean }> {
  const organization = await prisma.organization.findUniqueOrThrow({
    where: { id: organizationId },
  });
  const existing = await prisma.organizer.findUnique({
    where: { organizationId_email: { organizationId, email: input.email } },
  });
  if (existing) throw new AppError("Un compte existe déjà pour cette adresse.");
  const organizer = await prisma.organizer.create({
    data: { organizationId, email: input.email, name: input.name, role: input.role },
  });
  const sent = await sendInvitation(organization, organizer, actor.organizerName);
  await audit({
    organizationId,
    actorType: "organizer",
    actorId: actor.organizerId,
    action: "CREATE",
    entity: "Organizer",
    entityId: organizer.id,
    metadata: { role: input.role, invited: true, sent },
  });
  return { organizer, sent };
}

export async function resendInvitation(
  organizationId: string,
  organizerId: string,
  actor: Actor,
): Promise<boolean> {
  const [organization, organizer] = await Promise.all([
    prisma.organization.findUniqueOrThrow({ where: { id: organizationId } }),
    prisma.organizer.findFirst({ where: { id: organizerId, organizationId } }),
  ]);
  if (!organizer) throw new NotFoundError("Ce compte est introuvable.");
  if (!organizer.isActive) throw new AppError("Ce compte est désactivé.");
  if (organizer.passwordHash) throw new AppError("Ce compte est déjà activé.");
  return sendInvitation(organization, organizer, actor.organizerName);
}

async function activeOwnersOtherThan(organizationId: string, organizerId: string): Promise<number> {
  return prisma.organizer.count({
    where: { organizationId, role: "OWNER", isActive: true, id: { not: organizerId } },
  });
}

/** Role change with the guard: the organization always keeps at least one active owner. */
export async function setOrganizerRole(
  organizationId: string,
  organizerId: string,
  role: OrganizerRole,
  actor: Actor,
): Promise<void> {
  const organizer = await prisma.organizer.findFirst({
    where: { id: organizerId, organizationId },
  });
  if (!organizer) throw new NotFoundError("Ce compte est introuvable.");
  if (organizer.role === role) return;
  if (role === "STAFF" && organizer.isActive) {
    if ((await activeOwnersOtherThan(organizationId, organizerId)) === 0) {
      throw new AppError("Impossible : il doit rester au moins un propriétaire actif.");
    }
  }
  await prisma.organizer.update({
    where: { id: organizerId },
    data: { role, sessionVersion: { increment: 1 } },
  });
  await audit({
    organizationId,
    actorType: "organizer",
    actorId: actor.organizerId,
    action: "UPDATE",
    entity: "Organizer",
    entityId: organizerId,
    metadata: { role: { from: organizer.role, to: role } },
  });
}

/** Deactivation signs the person out everywhere; nobody can deactivate themselves. */
export async function setOrganizerActive(
  organizationId: string,
  organizerId: string,
  isActive: boolean,
  actor: Actor,
): Promise<void> {
  if (organizerId === actor.organizerId && !isActive) {
    throw new AppError("Vous ne pouvez pas désactiver votre propre compte.");
  }
  const organizer = await prisma.organizer.findFirst({
    where: { id: organizerId, organizationId },
  });
  if (!organizer) throw new NotFoundError("Ce compte est introuvable.");
  if (organizer.isActive === isActive) return;
  if (!isActive && organizer.role === "OWNER") {
    if ((await activeOwnersOtherThan(organizationId, organizerId)) === 0) {
      throw new AppError("Impossible : il doit rester au moins un propriétaire actif.");
    }
  }
  await prisma.organizer.update({
    where: { id: organizerId },
    data: { isActive, sessionVersion: { increment: 1 }, lockedUntil: null, failedLoginCount: 0 },
  });
  await audit({
    organizationId,
    actorType: "organizer",
    actorId: actor.organizerId,
    action: "STATUS_CHANGE",
    entity: "Organizer",
    entityId: organizerId,
    metadata: { isActive },
  });
}
