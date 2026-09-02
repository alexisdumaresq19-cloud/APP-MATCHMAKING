import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CheckinBoard } from "@/components/admin/checkin/checkin-board";
import { FormAlert } from "@/components/shared/form-field";
import { requireOrganizer } from "@/lib/auth/session";
import { formatDate } from "@/lib/dates";
import { prisma } from "@/lib/db/prisma";
import { getSectors } from "@/server/queries/admin";
import { listCheckinRows } from "@/server/queries/checkin";

export const metadata: Metadata = { title: "Jour J" };

export default async function DayOfPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { organization } = await requireOrganizer();
  const event = await prisma.event.findFirst({ where: { id, organizationId: organization.id } });
  if (!event) notFound();
  const [rows, sectors, snapshot] = await Promise.all([
    listCheckinRows(id),
    getSectors(organization.id),
    prisma.billingSnapshot.findUnique({ where: { eventId: id } }),
  ]);
  const completed = event.status === "COMPLETED" || event.status === "ARCHIVED";

  return (
    <div className="space-y-4">
      {completed && snapshot ? (
        <FormAlert
          variant="success"
          message={`Événement terminé le ${formatDate(snapshot.computedAt, organization.timezone, "short")} : ${snapshot.totalCheckedIn} présent${snapshot.totalCheckedIn > 1 ? "s" : ""} sur ${snapshot.totalRegistered} inscrit${snapshot.totalRegistered > 1 ? "s" : ""}. Le relevé de facturation est figé.`}
        />
      ) : !event.publishedAt ? (
        <FormAlert
          variant="info"
          message="Les jumelages ne sont pas encore publiés. Vous pouvez tout de même enregistrer les présences."
        />
      ) : null}
      <CheckinBoard
        eventId={id}
        eventName={event.name}
        rows={rows}
        sectors={sectors.filter((s) => s.isActive)}
        completed={completed}
        kiosk={false}
      />
    </div>
  );
}
