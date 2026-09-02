"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { MailIcon, MailXIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/shared/form-field";
import { setInvitationsOptOut } from "@/server/actions/participant-events";

export function InvitationsPreference({ token, optOut }: { token: string; optOut: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <div className="space-y-4 rounded-lg border bg-card p-5">
      <FormAlert
        variant="info"
        message={
          optOut
            ? "Vous ne recevez plus d'invitations par courriel."
            : "Vous recevez les invitations aux prochains événements."
        }
      />
      <Button
        type="button"
        variant="outline"
        size="lg"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await setInvitationsOptOut(token, !optOut);
            if (result && !result.ok) toast.error(result.formError ?? "Une erreur est survenue.");
            else {
              toast.success(result?.message ?? "Préférence enregistrée.");
              router.refresh();
            }
          })
        }
      >
        {optOut ? (
          <>
            <MailIcon aria-hidden="true" />
            Recevoir à nouveau les invitations
          </>
        ) : (
          <>
            <MailXIcon aria-hidden="true" />
            Ne plus recevoir d&apos;invitations
          </>
        )}
      </Button>
    </div>
  );
}
