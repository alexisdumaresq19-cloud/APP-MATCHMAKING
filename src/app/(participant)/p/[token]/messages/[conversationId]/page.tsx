import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { ContactActions } from "@/components/participant/contact-actions";
import { ConversationBlockButton } from "@/components/participant/conversation-block-button";
import { MessageThread } from "@/components/participant/message-thread";
import { resolveParticipantAccess } from "@/lib/auth/participant-session";
import { formatDate } from "@/lib/dates";
import { contactIdsOf } from "@/server/services/contacts";
import { getThread } from "@/server/services/messaging";

export const metadata: Metadata = { title: "Conversation" };

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ token: string; conversationId: string }>;
}) {
  const { token, conversationId } = await params;
  const context = await resolveParticipantAccess(token);
  if (!context) notFound();
  const { participant, organization } = context;
  const [thread, contactIds] = await Promise.all([
    getThread(participant.id, conversationId),
    contactIdsOf(participant.id),
  ]);
  if (!thread) notFound();
  const { conversation, messages } = thread;

  return (
    <div className="space-y-5">
      <Link
        href={`/p/${token}/messages`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" aria-hidden="true" />
        Messages
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{conversation.other.companyName}</h1>
          <p className="text-sm text-muted-foreground">
            {[conversation.other.firstName, conversation.other.sector].filter(Boolean).join(" · ")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ContactActions
            token={token}
            participantId={conversation.other.participantId}
            isContact={contactIds.has(conversation.other.participantId)}
            canMessage={false}
            compact
          />
          <ConversationBlockButton
            token={token}
            conversationId={conversation.id}
            blocked={conversation.blocked}
            blockedByMe={conversation.blockedByMe}
          />
        </div>
      </div>
      <MessageThread
        token={token}
        conversationId={conversation.id}
        otherCompany={conversation.other.companyName}
        blocked={conversation.blocked}
        blockedByMe={conversation.blockedByMe}
        messages={messages.map((m) => ({
          id: m.id,
          body: m.body,
          mine: m.mine,
          createdAtLabel: formatDate(m.createdAt, organization.timezone, "short"),
        }))}
      />
    </div>
  );
}
