/* eslint-disable @next/next/no-img-element */
import type { Organization } from "@prisma/client";
import { OrganizationNav } from "./organization-nav";

export function OrganizationHeader({ organization }: { organization: Organization }) {
  return (
    <header className="bg-brand text-brand-foreground">
      <div className="mx-auto flex w-full max-w-3xl items-center gap-4 px-4 pt-4 pb-2 sm:px-6">
        {organization.logoUrl ? (
          <img
            src={organization.logoUrl}
            alt={organization.name}
            className="h-12 w-auto max-w-[160px] rounded bg-white/90 object-contain p-1"
          />
        ) : null}
        <div className="min-w-0">
          <p className="truncate text-lg leading-tight font-bold">{organization.platformName}</p>
          <p className="truncate text-sm opacity-90">{organization.name}</p>
        </div>
      </div>
      <OrganizationNav slug={organization.slug} />
    </header>
  );
}
