import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormAlert } from "@/components/shared/form-field";
import { LoginForm } from "@/components/admin/auth/login-form";

export const metadata: Metadata = { title: "Connexion" };

const NOTICES: Record<string, { variant: "info" | "success" | "error"; message: string }> = {
  session: { variant: "info", message: "Votre session a expiré. Veuillez vous reconnecter." },
  "mot-de-passe-modifie": {
    variant: "success",
    message: "Votre mot de passe a été modifié. Vous pouvez vous connecter.",
  },
  deconnecte: { variant: "info", message: "Vous êtes déconnecté." },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; raison?: string }>;
}) {
  const { callbackUrl, raison } = await searchParams;
  const notice = raison ? NOTICES[raison] : undefined;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">Connexion</CardTitle>
        <CardDescription>Accédez à vos événements, à vos inscrits et au jumelage.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {notice ? <FormAlert variant={notice.variant} message={notice.message} /> : null}
        <LoginForm callbackUrl={callbackUrl} />
      </CardContent>
    </Card>
  );
}
