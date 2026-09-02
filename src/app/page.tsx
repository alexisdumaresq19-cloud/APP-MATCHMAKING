import Link from "next/link";
import { PoweredBy } from "@/components/shared/powered-by";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col items-center justify-center gap-6 p-6 text-center">
      <h1 className="text-3xl font-bold tracking-tight">Jumelage</h1>
      <p className="text-lg text-muted-foreground">
        Plateforme de jumelage pour événements de réseautage d'affaires. Pour vous inscrire à un
        événement, utilisez le lien fourni par l'organisatrice.
      </p>
      <Link href="/admin/login" className="text-brand underline underline-offset-4">
        Espace organisateur
      </Link>
      <PoweredBy />
    </main>
  );
}
