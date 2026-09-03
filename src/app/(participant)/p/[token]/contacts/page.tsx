import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DownloadIcon, ExternalLinkIcon, MapPinIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { ContactActions } from "@/components/participant/contact-actions";
import { ContactNoteForm } from "@/components/participant/contact-note-form";
import { EmptyState } from "@/components/shared/empty-state";
import { resolveParticipantAccess } from "@/lib/auth/participant-session";
import { cn } from "@/lib/utils";
import { listContacts } from "@/server/services/contacts";

export const metadata: Metadata = { title: "Mes contacts" };

/** The address book (Phase 2, D-37): companies bookmarked from matches or the directory. */
export default async function ContactsPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const context = await resolveParticipantAccess(token);
  if (!context) notFound();
  const { participant, organization } = context;
  const contacts = await listContacts(participant.id);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Mes contacts</h1>
          <p className="mt-1 text-base text-muted-foreground">
            Les entreprises que vous avez gardées, avec vos notes. Elles ne voient pas cette liste.
          </p>
        </div>
        {contacts.length ? (
          <a
            href={`/p/${token}/contacts/export.csv`}
            className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
          >
            <DownloadIcon aria-hidden="true" />
            Exporter (CSV)
          </a>
        ) : null}
      </div>

      {contacts.length === 0 ? (
        <EmptyState
          icon="users-round"
          title="Aucun contact pour l'instant"
          description="Depuis vos jumelages ou l'annuaire des entreprises, cliquez « Ajouter à mes contacts »."
        />
      ) : (
        <ul className="space-y-4">
          {contacts.map((contact) => (
            <li key={contact.id} className="space-y-3 rounded-lg border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-lg font-semibold">
                    {contact.listedPublicly ? (
                      <Link
                        href={`/${organization.slug}/entreprises/${contact.participantId}`}
                        className="hover:underline"
                      >
                        {contact.companyName}
                      </Link>
                    ) : (
                      contact.companyName
                    )}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {[contact.firstName, contact.sector].filter(Boolean).join(" · ")}
                  </p>
                  {contact.city || contact.region ? (
                    <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <MapPinIcon className="size-4 shrink-0" aria-hidden="true" />
                      {[contact.city, contact.region].filter(Boolean).join(", ")}
                    </p>
                  ) : null}
                  {contact.website ? (
                    <a
                      href={contact.website}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="inline-flex items-center gap-1 text-sm text-brand underline-offset-4 hover:underline"
                    >
                      <ExternalLinkIcon className="size-4" aria-hidden="true" />
                      Site web
                    </a>
                  ) : null}
                  {contact.eventName ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Rencontré à : {contact.eventName}
                    </p>
                  ) : null}
                </div>
                <ContactActions
                  token={token}
                  participantId={contact.participantId}
                  isContact
                  compact
                />
              </div>
              <ContactNoteForm
                token={token}
                contactId={contact.participantId}
                note={contact.note}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
