import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { KeepProfileButton } from "@/components/participant/keep-profile-button";
import { resolveParticipantAccess } from "@/lib/auth/participant-session";

export const metadata: Metadata = { title: "Conserver mon profil" };

/** Landing page of the retention notice (P2-S3, D-39). */
export default async function KeepProfilePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const context = await resolveParticipantAccess(token);
  if (!context) notFound();
  const { participant, organization } = context;
  const pending = participant.purgeNoticeSentAt !== null;

  return (
    <div className="mx-auto max-w-md space-y-6 text-center">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Conserver mon profil</h1>
      <p className="text-base text-muted-foreground">
        {pending
          ? `Votre profil chez ${organization.name} est inactif depuis plus de deux ans et sera anonymisé dans les prochains jours. Pour rester dans le réseau, confirmez ci-dessous.`
          : `Votre profil chez ${organization.name} est actif : aucune suppression n'est prévue.`}
      </p>
      <KeepProfileButton token={token} pending={pending} />
    </div>
  );
}
