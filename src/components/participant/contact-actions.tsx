"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { CheckIcon, MessageSquareIcon, UserRoundPlusIcon, UserRoundXIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  addContactAction,
  removeContactAction,
  startConversation,
} from "@/server/actions/messaging";
import type { ActionState } from "@/server/actions/types";

/**
 * The two post-match actions of the guideline: « Envoyer un message » and « Ajouter à mes
 * contacts », on match cards, company cards and the address book (Phase 2, D-37).
 */
export function ContactActions({
  token,
  participantId,
  eventId = null,
  isContact,
  canMessage = true,
  compact = false,
}: {
  token: string;
  participantId: string;
  eventId?: string | null;
  isContact: boolean;
  canMessage?: boolean;
  compact?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const size = compact ? "sm" : "default";

  function run(work: () => Promise<ActionState>) {
    startTransition(async () => {
      const result = await work();
      if (result && !result.ok) toast.error(result.formError ?? "Une erreur est survenue.");
      else if (result?.message) {
        toast.success(result.message);
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      {canMessage ? (
        <Button
          type="button"
          size={size}
          disabled={pending}
          className="bg-brand text-brand-foreground hover:bg-brand/90"
          onClick={() => run(() => startConversation(token, participantId))}
        >
          <MessageSquareIcon aria-hidden="true" />
          Message
        </Button>
      ) : null}
      <Button
        type="button"
        variant={isContact ? "outline" : "secondary"}
        size={size}
        disabled={pending}
        onClick={() =>
          run(() =>
            isContact
              ? removeContactAction(token, participantId)
              : addContactAction(token, participantId, eventId),
          )
        }
      >
        {isContact ? (
          <>
            <CheckIcon aria-hidden="true" />
            Dans mes contacts
            <UserRoundXIcon className="opacity-60" aria-hidden="true" />
          </>
        ) : (
          <>
            <UserRoundPlusIcon aria-hidden="true" />
            Ajouter à mes contacts
          </>
        )}
      </Button>
    </div>
  );
}
