import type { Organization } from "@prisma/client";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/db/prisma";
import { checkLogoUpload } from "@/lib/uploads";
import { AppError } from "@/lib/errors";

type Actor = { organizerId: string };

export type OrganizationSettings = {
  name: string;
  platformName: string;
  privacyEmail: string;
  replyToEmail: string;
  timezone: string;
  primaryColor: string;
  accentColor: string;
};

export async function updateOrganizationSettings(
  organizationId: string,
  data: OrganizationSettings,
  actor: Actor,
): Promise<Organization> {
  const updated = await prisma.organization.update({ where: { id: organizationId }, data });
  await audit({
    organizationId,
    actorType: "organizer",
    actorId: actor.organizerId,
    action: "UPDATE",
    entity: "Organization",
    entityId: organizationId,
    metadata: { fields: Object.keys(data) },
  });
  return updated;
}

/** Public URL of the stored logo; the version query defeats caches after a replacement. */
export function logoUrlFor(organization: Pick<Organization, "slug" | "updatedAt">): string {
  return `/${organization.slug}/logo?v=${organization.updatedAt.getTime()}`;
}

/** Stores the uploaded logo in the database after sniffing its real type (D-31). */
export async function saveOrganizationLogo(
  organizationId: string,
  bytes: Uint8Array,
  actor: Actor,
): Promise<Organization> {
  const check = checkLogoUpload(bytes);
  if (!check.ok) throw new AppError(check.error);
  const updated = await prisma.organization.update({
    where: { id: organizationId },
    data: { logoData: Buffer.from(check.bytes), logoMimeType: check.mimeType },
  });
  const withUrl = await prisma.organization.update({
    where: { id: organizationId },
    data: { logoUrl: logoUrlFor(updated) },
  });
  await audit({
    organizationId,
    actorType: "organizer",
    actorId: actor.organizerId,
    action: "UPDATE",
    entity: "Organization",
    entityId: organizationId,
    metadata: { logo: "replaced", mimeType: check.mimeType, bytes: check.bytes.length },
  });
  return withUrl;
}

export async function removeOrganizationLogo(
  organizationId: string,
  actor: Actor,
): Promise<Organization> {
  const updated = await prisma.organization.update({
    where: { id: organizationId },
    data: { logoData: null, logoMimeType: null, logoUrl: null },
  });
  await audit({
    organizationId,
    actorType: "organizer",
    actorId: actor.organizerId,
    action: "UPDATE",
    entity: "Organization",
    entityId: organizationId,
    metadata: { logo: "removed" },
  });
  return updated;
}
