import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PasswordResetRequestForm } from "@/components/admin/auth/password-reset-forms";

export const metadata: Metadata = { title: "Mot de passe oublié" };

export default function ForgotPasswordPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">Mot de passe oublié</CardTitle>
        <CardDescription>
          Entrez votre courriel : nous vous enverrons un lien pour choisir un nouveau mot de passe.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <PasswordResetRequestForm />
      </CardContent>
    </Card>
  );
}
