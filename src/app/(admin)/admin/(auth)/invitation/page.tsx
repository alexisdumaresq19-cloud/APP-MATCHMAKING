import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InviteAcceptForm } from "@/components/admin/auth/invite-accept-form";
import { peekOrganizerToken } from "@/lib/auth/organizer-token";

export const metadata: Metadata = { title: "Activer mon compte" };

export default async function InvitationPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token = "" } = await searchParams;
  const organizer = token ? await peekOrganizerToken(token, "INVITE") : null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">
          {organizer ? `Bienvenue ${organizer.name}` : "Invitation invalide"}
        </CardTitle>
        <CardDescription>
          {organizer
            ? `Compte : ${organizer.email}. Choisissez votre mot de passe pour activer l'accès.`
            : "Cette invitation a expiré ou a déjà été utilisée. Demandez-en une nouvelle à un propriétaire."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {organizer ? (
          <InviteAcceptForm token={token} />
        ) : (
          <Link href="/admin/login" className="text-brand underline underline-offset-4">
            Aller à la connexion
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
