import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { BrandProvider } from "@/components/shared/brand-provider";
import { PoweredBy } from "@/components/shared/powered-by";
import { OrganizationHeader } from "@/components/public/organization-header";
import { getOrganizationBySlug } from "@/server/queries/public";

/** Chrome of the organization's public pages: showcase, companies directory, access, privacy. */
export default async function OrganizationPagesLayout({
  params,
  children,
}: {
  params: Promise<{ orgSlug: string }>;
  children: ReactNode;
}) {
  const { orgSlug } = await params;
  const organization = await getOrganizationBySlug(orgSlug);
  if (!organization) notFound();

  return (
    <BrandProvider colors={organization}>
      <div className="flex min-h-dvh flex-col">
        <OrganizationHeader organization={organization} />
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">{children}</main>
        <footer className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
          <div className="flex flex-col gap-2 border-t pt-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <a
              href={`/${organization.slug}/confidentialite`}
              className="underline-offset-4 hover:underline"
            >
              Confidentialité et renseignements personnels
            </a>
            <PoweredBy />
          </div>
        </footer>
      </div>
    </BrandProvider>
  );
}
