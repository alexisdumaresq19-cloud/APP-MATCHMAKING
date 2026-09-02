import type { Metadata } from "next";
import { LinkIcon } from "lucide-react";
import { PoweredBy } from "@/components/shared/powered-by";
import { ResendLinkForm } from "@/components/participant/resend-link-form";

export const metadata: Metadata = { title: "Lien expiré" };

export default function ExpiredLinkPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 px-4 py-10">
      <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-muted">
        <LinkIcon className="size-7 text-muted-foreground" aria-hidden="true" />
      </div>
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-bold tracking-tight">Ce lien n'est plus valide</h1>
        <p className="text-base text-muted-foreground">
          Il a peut-être expiré ou été remplacé. Entrez votre adresse courriel pour en recevoir un
          nouveau.
        </p>
      </div>
      <ResendLinkForm />
      <PoweredBy className="text-center" />
    </main>
  );
}
