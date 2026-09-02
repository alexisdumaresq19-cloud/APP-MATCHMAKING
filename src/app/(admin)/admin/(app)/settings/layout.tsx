import type { ReactNode } from "react";
import { PageHeader } from "@/components/admin/page-header";
import { SettingsNav } from "@/components/admin/settings/settings-nav";

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <PageHeader
        title="Paramètres"
        description="Organisation, secteurs, matrice d'affinité, règles de matching, consentement, comptes et facturation."
      />
      <SettingsNav />
      <div className="mt-6">{children}</div>
    </>
  );
}
