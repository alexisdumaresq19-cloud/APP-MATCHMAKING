import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProfileForm } from "@/components/participant/profile-form";
import { resolveParticipantAccess } from "@/lib/auth/participant-session";
import { REGIONS } from "@/lib/regions";
import { updateParticipantProfile } from "@/server/actions/participant";
import { getActiveSectors } from "@/server/queries/public";
import { getTagSuggestions } from "@/server/queries/tags";

export const metadata: Metadata = { title: "Mon profil" };

export default async function ParticipantProfilePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const context = await resolveParticipantAccess(token);
  if (!context) notFound();
  const { participant, organization } = context;
  const [sectors, tagSuggestions] = await Promise.all([
    getActiveSectors(organization.id),
    getTagSuggestions(organization.id),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Mon profil</h1>
        <p className="mt-1 text-base text-muted-foreground">
          Ces renseignements servent à vous jumeler. Tenez-les à jour avant chaque événement.
        </p>
      </div>
      <ProfileForm
        action={updateParticipantProfile.bind(null, token)}
        initial={{
          firstName: participant.firstName,
          lastName: participant.lastName,
          email: participant.email,
          phone: participant.phone,
          jobTitle: participant.jobTitle,
          companyName: participant.companyName,
          sectorId: participant.sectorId,
          region: participant.region,
          city: participant.city,
          website: participant.website,
          description: participant.description,
          offers: participant.offers,
          needs: participant.needs,
        }}
        sectors={sectors}
        regions={REGIONS}
        tagSuggestions={tagSuggestions}
      />
    </div>
  );
}
