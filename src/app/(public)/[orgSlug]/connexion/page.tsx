import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { KeyRoundIcon } from "lucide-react";
import { ResendLinkForm } from "@/components/participant/resend-link-form";
import { getOrganizationBySlug } from "@/server/queries/public";

export const metadata: Metadata = { title: "Mon accès" };

/** « Mon accès » : a company gets its personal link back by email (Phase 2, D-36). */
export default async function AccessPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const organization = await getOrganizationBySlug(orgSlug);
  if (!organization) notFound();

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-brand/10">
        <KeyRoundIcon className="size-7 text-brand" aria-hidden="true" />
      </div>
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Mon accès personnel</h1>
        <p className="text-base text-muted-foreground">
          Pas de mot de passe à retenir. Entrez le courriel utilisé lors de votre inscription : nous
          vous envoyons votre lien personnel pour retrouver vos jumelages, vos événements et votre
          profil.
        </p>
      </div>
      <ResendLinkForm />
      <p className="text-center text-sm text-muted-foreground">
        Pas encore de profil?{" "}
        <Link href={`/${orgSlug}`} className="text-brand underline underline-offset-4">
          Inscrivez-vous à un événement
        </Link>
        .
      </p>
    </div>
  );
}
