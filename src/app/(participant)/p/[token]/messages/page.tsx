import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRightIcon, LockIcon } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { resolveParticipantAccess } from "@/lib/auth/participant-session";
import { formatDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { listConversations } from "@/server/services/messaging";

export const metadata: Metadata = { title: "Messages" };

/** « Messages » : one thread per company (Phase 2, D-37). */
export default async function MessagesPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const context = await resolveParticipantAccess(token);
  if (!context) notFound();
  const { participant, organization } = context;
  const conversations = await listConversations(participant.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Messages</h1>
        <p className="mt-1 text-base text-muted-foreground">
          Vos échanges avec les entreprises rencontrées. Rien ne sort de la plateforme : ni votre
          courriel ni votre téléphone.
        </p>
      </div>
      {conversations.length === 0 ? (
        <EmptyState
          icon="handshake"
          title="Aucune conversation"
          description="Écrivez à une entreprise depuis vos jumelages ou depuis l'annuaire des entreprises."
        />
      ) : (
        <ul className="divide-y rounded-lg border bg-card">
          {conversations.map((conversation) => (
            <li key={conversation.id}>
              <Link
                href={`/p/${token}/messages/${conversation.id}`}
                className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        "text-base",
                        conversation.unread ? "font-bold" : "font-semibold",
                      )}
                    >
                      {conversation.other.companyName}
                    </span>
                    {conversation.unread ? (
                      <span className="rounded-full bg-brand px-2 text-xs font-semibold text-brand-foreground tabular-nums">
                        {conversation.unread}
                      </span>
                    ) : null}
                    {conversation.blocked ? (
                      <LockIcon className="size-4 text-muted-foreground" aria-label="Fermée" />
                    ) : null}
                  </p>
                  <p className="text-sm text-muted-foreground">{conversation.other.sector ?? ""}</p>
                  {conversation.lastMessage ? (
                    <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">
                      {conversation.lastMessage.mine ? "Vous : " : ""}
                      {conversation.lastMessage.body}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                  {conversation.lastMessage
                    ? formatDate(conversation.lastMessage.createdAt, organization.timezone, "short")
                    : ""}
                  <ChevronRightIcon className="size-5" aria-hidden="true" />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
