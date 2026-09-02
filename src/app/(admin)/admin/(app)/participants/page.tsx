import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/page-header";
import { ComingSoon } from "@/components/admin/coming-soon";

export const metadata: Metadata = { title: "Participants" };

export default function ParticipantsPage() {
  return (
    <>
      <PageHeader
        title="Participants"
        description="Annuaire de tous les participants de votre organisation."
      />
      <ComingSoon title="Annuaire des participants" week={4} />
    </>
  );
}
