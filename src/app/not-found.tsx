import { NotFoundStacked } from "@/components/motion/not-found/stacked";
import { PoweredBy } from "@/components/shared/powered-by";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col items-center justify-center gap-6 p-6 text-center">
      <NotFoundStacked
        caption="cette page n'est pas dans le jeu"
        title="Page introuvable"
        description="Cette page n'existe pas ou n'est plus disponible. Vérifiez le lien que vous avez reçu."
        homeHref="/"
        homeLabel="Retour à l'accueil"
      />
      <PoweredBy />
    </main>
  );
}
