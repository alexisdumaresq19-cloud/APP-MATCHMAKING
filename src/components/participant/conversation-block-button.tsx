"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { LockIcon, LockOpenIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toggleConversationBlocked } from "@/server/actions/messaging";

export function ConversationBlockButton({
  token,
  conversationId,
  blocked,
  blockedByMe,
}: {
  token: string;
  conversationId: string;
  blocked: boolean;
  blockedByMe: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  if (blocked && !blockedByMe) return null;
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await toggleConversationBlocked(token, conversationId, !blocked);
          if (result && !result.ok) toast.error(result.formError ?? "Une erreur est survenue.");
          else {
            toast.success(result?.message ?? "Enregistré.");
            router.refresh();
          }
        })
      }
    >
      {blocked ? (
        <>
          <LockOpenIcon aria-hidden="true" />
          Rouvrir la conversation
        </>
      ) : (
        <>
          <LockIcon aria-hidden="true" />
          Fermer la conversation
        </>
      )}
    </Button>
  );
}
