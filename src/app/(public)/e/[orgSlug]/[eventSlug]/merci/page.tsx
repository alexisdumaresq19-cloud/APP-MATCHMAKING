import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MailCheckIcon } from "lucide-react";
import { resolveTransportKind } from "@/lib/email/transport";
import { getPublicEvent } from "@/server/queries/public";

export const metadata: Metadata = { title: "Merci" };

export default async function ThankYouPage({
  params,
}: {
  params: Promise<{ orgSlug: string; eventSlug: string }>;
}) {
  const { orgSlug, eventSlug } = await params;
  const event = await getPublicEvent(orgSlug, eventSlug);
  if (!event) notFound();
  const testMode = resolveTransportKind() === "console";

  return (
    <div className="space-y-6 text-center">
      <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-brand/10 text-brand">
        <MailCheckIcon className="size-8" aria-hidden="true" />
      </div>
      <h1 className="text-3xl font-bold tracking-tight">Merci!</h1>
      <p className="text-lg">
        Nous venons de vous envoyer un courriel pour <strong>{event.name}</strong>. Il contient
        votre lien personnel : conservez-le, c'est par là que vous consulterez votre profil, vos
        jumelages et votre table.
      </p>
      <div className="rounded-lg border bg-muted/40 p-4 text-left text-base text-muted-foreground">
        <p>
          Vous ne voyez rien? Vérifiez vos courriels indésirables. Si vous aviez déjà un profil chez
          nous, le courriel contient plutôt un lien pour vous inscrire en un clic avec ce profil.
        </p>
      </div>
      {testMode ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-left text-base text-amber-900">
          <p>
            <strong>Mode test :</strong> aucun service de courriel n'est configuré, le courriel n'a
            donc pas été envoyé. L'organisatrice le retrouvera, avec votre lien personnel, dans «
            Courriels (test) » de son espace.
          </p>
        </div>
      ) : null}
      <Link
        href={`/e/${orgSlug}/${eventSlug}`}
        className="inline-block text-brand underline underline-offset-4"
      >
        Retour à la page de l'événement
      </Link>
    </div>
  );
}
