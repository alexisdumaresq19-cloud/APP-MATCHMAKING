import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PasswordResetForm } from "@/components/admin/auth/password-reset-forms";
import { peekOrganizerToken } from "@/lib/auth/organizer-token";

export const metadata: Metadata = { title: "Nouveau mot de passe" };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token = "" } = await searchParams;
  const organizer = token ? await peekOrganizerToken(token, "PASSWORD_RESET") : null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">
          {organizer ? "Choisir un nouveau mot de passe" : "Lien invalide"}
        </CardTitle>
        <CardDescription>
          {organizer
            ? `Compte : ${organizer.email}. Au moins 10 caractères.`
            : "Ce lien a expiré ou a déjà été utilisé."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {organizer ? (
          <PasswordResetForm token={token} />
        ) : (
          <Link
            href="/admin/mot-de-passe-oublie"
            className="text-brand underline underline-offset-4"
          >
            Faire une nouvelle demande
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
