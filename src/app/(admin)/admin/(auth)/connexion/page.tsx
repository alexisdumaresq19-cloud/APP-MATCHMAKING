import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MagicLinkConfirm } from "@/components/admin/auth/magic-link-confirm";
import { peekOrganizerToken } from "@/lib/auth/organizer-token";

export const metadata: Metadata = { title: "Connexion par lien" };

export default async function MagicLinkPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token = "" } = await searchParams;
  const organizer = token ? await peekOrganizerToken(token, "MAGIC_LINK") : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">
          {organizer ? `Bonjour ${organizer.name}` : "Lien invalide"}
        </CardTitle>
        <CardDescription>
          {organizer
            ? "Confirmez pour ouvrir votre session organisateur."
            : "Ce lien de connexion a expiré ou a déjà été utilisé."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {organizer ? (
          <MagicLinkConfirm token={token} />
        ) : (
          <Link href="/admin/login" className="text-brand underline underline-offset-4">
            Demander un nouveau lien
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
