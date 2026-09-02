import type { Metadata } from "next";
import { ConsentEditor } from "@/components/admin/settings/consent-editor";
import { requireOrganizer } from "@/lib/auth/session";
import { formatDate } from "@/lib/dates";
import { prisma } from "@/lib/db/prisma";
import { listConsentVersions } from "@/server/services/consent-versions";

export const metadata: Metadata = { title: "Consentement" };

export default async function ConsentSettingsPage() {
  const { organization, organizer } = await requireOrganizer();
  const [versions, participants] = await Promise.all([
    listConsentVersions(organization.id),
    prisma.participant.count({ where: { organizationId: organization.id, deletedAt: null } }),
  ]);
  return (
    <ConsentEditor
      readOnly={organizer.role !== "OWNER"}
      currentText={organization.consentText}
      participantsToReconsent={participants}
      versions={versions.map((v) => ({
        id: v.id,
        version: v.version,
        text: v.text,
        note: v.note,
        createdAtLabel:
          v.createdAt.getTime() === 0
            ? "À la création de l'organisation"
            : formatDate(v.createdAt, organization.timezone, "short"),
        authorName: v.authorName,
        acceptedCount: v.acceptedCount,
        isCurrent: v.isCurrent,
      }))}
    />
  );
}
