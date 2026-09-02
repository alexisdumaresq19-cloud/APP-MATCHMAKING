import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { DeletionQueue } from "@/components/admin/participants/deletion-queue";
import { PageHeader } from "@/components/admin/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { requireOrganizer } from "@/lib/auth/session";
import { formatDate } from "@/lib/dates";
import { listDeletionRequests } from "@/server/queries/participants";

export const metadata: Metadata = { title: "Demandes de suppression" };

const LEGAL_DAYS = 30;

export default async function DeletionRequestsPage() {
  const { organization } = await requireOrganizer();
  const requests = await listDeletionRequests(organization.id);
  const pending = requests.filter((r) => r.status === "PENDING").length;
  return (
    <>
      <PageHeader
        eyebrow={
          <Link
            href="/admin/participants"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeftIcon className="size-4" aria-hidden="true" />
            Participants
          </Link>
        }
        title="Demandes de suppression"
        description={`Loi 25 : ${LEGAL_DAYS} jours pour répondre. ${pending} demande${pending > 1 ? "s" : ""} à traiter.`}
      />
      {requests.length === 0 ? (
        <EmptyState
          icon="shield-check"
          title="Aucune demande"
          description="Les demandes faites par les participants depuis « Mes données » apparaîtront ici."
        />
      ) : (
        <DeletionQueue
          requests={requests.map((r) => ({
            id: r.id,
            status: r.status,
            requestedAtLabel: formatDate(r.requestedAt, organization.timezone, "short"),
            resolvedAtLabel: r.resolvedAt
              ? formatDate(r.resolvedAt, organization.timezone, "short")
              : null,
            daysLeft: Math.ceil(
              (r.requestedAt.getTime() + LEGAL_DAYS * 86_400_000 - Date.now()) / 86_400_000,
            ),
            note: r.note,
            participant: {
              id: r.participant.id,
              name: `${r.participant.firstName} ${r.participant.lastName}`,
              email: r.participant.email,
              company: r.participant.companyName,
              anonymized: r.participant.deletedAt !== null,
            },
          }))}
        />
      )}
    </>
  );
}
