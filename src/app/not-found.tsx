import Link from "next/link";
import { PoweredBy } from "@/components/shared/powered-by";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col items-center justify-center gap-6 p-6 text-center">
      <h1 className="text-3xl font-bold tracking-tight">Page introuvable</h1>
      <p className="text-lg text-muted-foreground">
        Cette page n'existe pas ou n'est plus disponible. Vérifiez le lien que vous avez reçu.
      </p>
      <Link href="/" className="text-brand underline underline-offset-4">
        Retour à l'accueil
      </Link>
      <PoweredBy />
    </main>
  );
}
