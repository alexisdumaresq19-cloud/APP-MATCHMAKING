import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { BrandProvider } from "@/components/shared/brand-provider";
import { PoweredBy } from "@/components/shared/powered-by";
import { ParticipantNav } from "@/components/participant/participant-nav";
import { resolveParticipantAccess } from "@/lib/auth/participant-session";

export default async function ParticipantLayout({
  params,
  children,
}: {
  params: Promise<{ token: string }>;
  children: ReactNode;
}) {
  const { token } = await params;
  const context = await resolveParticipantAccess(token);
  if (!context) redirect("/p/lien-expire");
  const { organization, participant } = context;

  return (
    <BrandProvider colors={organization}>
      <div className="flex min-h-dvh flex-col">
        <header className="bg-brand text-brand-foreground">
          <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
            <div className="min-w-0">
              <p className="truncate text-base leading-tight font-bold">
                {organization.platformName}
              </p>
              <p className="truncate text-xs opacity-90">{organization.name}</p>
            </div>
            <p className="truncate text-sm font-medium">
              {participant.firstName} {participant.lastName}
            </p>
          </div>
          <ParticipantNav token={token} />
        </header>
        <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6 sm:px-6">{children}</main>
        <footer className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6">
          <div className="flex flex-col gap-2 border-t pt-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <a
              href={`/${organization.slug}/confidentialite`}
              className="underline-offset-4 hover:underline"
            >
              Confidentialité
            </a>
            <PoweredBy />
          </div>
        </footer>
      </div>
    </BrandProvider>
  );
}
