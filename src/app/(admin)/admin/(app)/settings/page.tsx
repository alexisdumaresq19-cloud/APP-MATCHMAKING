import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/page-header";
import { ComingSoon } from "@/components/admin/coming-soon";

export const metadata: Metadata = { title: "Paramètres" };

export default function SettingsPage() {
  return (
    <>
      <PageHeader
        title="Paramètres"
        description="Organisation, secteurs, règles de matching, consentement, comptes et facturation."
      />
      <ComingSoon title="Paramètres" week={2} />
    </>
  );
}
