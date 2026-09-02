import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { InvitationsPreference } from "@/components/participant/invitations-preference";
import { resolveParticipantAccess } from "@/lib/auth/participant-session";

export const metadata: Metadata = { title: "Invitations" };

/** Landing page of the « Ne plus recevoir d'invitations » link (anti-spam law, D-35). */
export default async function InvitationsPreferencePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const context = await resolveParticipantAccess(token);
  if (!context) notFound();
  const { participant, organization } = context;

  return (
    <div className="space-y-6">
      <Link
        href={`/p/${token}/donnees`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" aria-hidden="true" />
        Mes données
      </Link>
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Invitations par courriel</h1>
        <p className="mt-1 text-base text-muted-foreground">
          {organization.name} peut vous écrire quand un nouvel événement de réseautage ouvre ses
          inscriptions. Vous restez libre de changer d&apos;avis à tout moment; vos courriels
          d&apos;inscription, de jumelages et de rappel ne sont pas concernés.
        </p>
      </div>
      <InvitationsPreference token={token} optOut={participant.invitationsOptOut} />
    </div>
  );
}
