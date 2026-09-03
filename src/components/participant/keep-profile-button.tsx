"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { ShieldCheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { keepMyProfile } from "@/server/actions/retention";

export function KeepProfileButton({ token, pending }: { token: string; pending: boolean }) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  if (!pending) return null;
  return (
    <Button
      type="button"
      size="lg"
      disabled={busy}
      className="bg-brand text-brand-foreground hover:bg-brand/90"
      onClick={() =>
        startTransition(async () => {
          const result = await keepMyProfile(token);
          if (result && !result.ok) toast.error(result.formError ?? "Une erreur est survenue.");
          else {
            toast.success(result?.message ?? "Profil conservé.");
            router.refresh();
          }
        })
      }
    >
      <ShieldCheckIcon aria-hidden="true" />
      Conserver mon profil
    </Button>
  );
}
