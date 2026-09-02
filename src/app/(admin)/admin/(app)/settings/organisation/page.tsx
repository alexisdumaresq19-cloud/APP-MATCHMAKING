import type { Metadata } from "next";
import { LogoForm } from "@/components/admin/settings/logo-form";
import { OrganizationForm } from "@/components/admin/settings/organization-form";
import { requireOrganizer } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Organisation" };

export default async function OrganizationSettingsPage() {
  const { organization, organizer } = await requireOrganizer();
  const readOnly = organizer.role !== "OWNER";
  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Identité et couleurs</h2>
          <p className="text-sm text-muted-foreground">
            Ces réglages s'appliquent partout : pages publiques, espace participant, courriels et
            plan de tables imprimé.
          </p>
        </div>
        <OrganizationForm
          readOnly={readOnly}
          initial={{
            name: organization.name,
            platformName: organization.platformName,
            privacyEmail: organization.privacyEmail,
            replyToEmail: organization.replyToEmail,
            timezone: organization.timezone,
            primaryColor: organization.primaryColor,
            accentColor: organization.accentColor,
          }}
        />
      </section>
      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Logo</h2>
          <p className="text-sm text-muted-foreground">
            Affiché dans l'en-tête des pages publiques et de l'espace participant.
          </p>
        </div>
        <LogoForm logoUrl={organization.logoUrl} readOnly={readOnly} />
      </section>
      <section className="space-y-1 text-sm text-muted-foreground">
        <p>
          Adresse publique de votre organisation :{" "}
          <span className="font-mono text-foreground">/e/{organization.slug}/…</span>. Le lien ne
          change pas; pour le modifier, écrivez à AD Création.
        </p>
      </section>
    </div>
  );
}
