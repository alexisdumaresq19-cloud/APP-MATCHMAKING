import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { InboxIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/admin/page-header";
import { FormAlert } from "@/components/shared/form-field";
import { requireOrganizer } from "@/lib/auth/session";
import { formatDate } from "@/lib/dates";
import { prisma } from "@/lib/db/prisma";
import { resolveTransportKind } from "@/lib/email/transport";

export const metadata: Metadata = { title: "Courriels (mode test)" };

const TEMPLATE_LABELS: Record<string, string> = {
  registration_confirmed: "Confirmation d'inscription",
  existing_profile_link: "Profil existant",
  participant_link: "Lien d'accès",
  consent_pending: "Consentement en attente",
  magic_link: "Lien de connexion",
  password_reset: "Réinitialisation du mot de passe",
  matches_published: "Jumelages publiés",
  reminder: "Rappel",
  deletion_confirmed: "Suppression confirmée",
  organizer_invite: "Invitation",
};

/** Turns http(s) URLs of a plain-text body into clickable links. */
function linkify(text: string) {
  const parts = text.split(/(https?:\/\/[^\s]+)/g);
  return parts.map((part, index) =>
    /^https?:\/\//.test(part) ? (
      <a key={index} href={part} className="break-all text-primary underline underline-offset-4">
        {part}
      </a>
    ) : (
      <span key={index}>{part}</span>
    ),
  );
}

/**
 * Test mailbox: available only when no email provider is configured (console transport).
 * Lets testers open the links that would otherwise have been emailed.
 */
export default async function MailboxPage() {
  if (resolveTransportKind() !== "console") notFound();
  const { organization } = await requireOrganizer();
  const emails = await prisma.emailLog.findMany({
    where: { organizationId: organization.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <>
      <PageHeader
        title="Courriels (mode test)"
        description="Aucun service d'envoi n'est configuré : les courriels ne partent pas, ils sont affichés ici pour que vous puissiez cliquer sur les liens. Configurez RESEND_API_KEY ou SMTP pour l'envoi réel."
      />
      {emails.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <InboxIcon className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
          <p className="mt-3 text-base text-muted-foreground">
            Aucun courriel pour l'instant. Inscrivez-vous à un événement depuis sa page publique
            pour en voir apparaître.
          </p>
        </div>
      ) : (
        <ul className="space-y-4">
          {emails.map((email) => (
            <li key={email.id} className="rounded-lg border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold">
                    {email.subject ?? TEMPLATE_LABELS[email.template] ?? email.template}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    À : {email.toEmail} ·{" "}
                    {formatDate(email.createdAt, organization.timezone, "short")}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Badge variant="secondary">
                    {TEMPLATE_LABELS[email.template] ?? email.template}
                  </Badge>
                  <Badge variant={email.status === "sent" ? "outline" : "destructive"}>
                    {email.status === "sent" ? "Non envoyé (mode test)" : "Échec"}
                  </Badge>
                </div>
              </div>
              {email.previewText ? (
                <details className="mt-3">
                  <summary className="cursor-pointer text-sm font-medium text-primary">
                    Voir le contenu et les liens
                  </summary>
                  <pre className="mt-2 max-h-96 overflow-auto rounded-md bg-muted p-3 font-sans text-sm whitespace-pre-wrap">
                    {linkify(email.previewText)}
                  </pre>
                </details>
              ) : email.error ? (
                <FormAlert className="mt-3" message={email.error} />
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
