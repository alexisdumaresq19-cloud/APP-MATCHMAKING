"use client";

import { useFormStatus } from "react-dom";
import { Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = React.ComponentProps<typeof Button> & { pendingLabel?: string };

export function SubmitButton({ children, pendingLabel, className, disabled, ...props }: Props) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      disabled={pending || disabled}
      aria-busy={pending || undefined}
      className={cn("touch-target", className)}
      {...props}
    >
      {pending ? (
        <>
          <Loader2Icon className="animate-spin" aria-hidden="true" />
          {pendingLabel ?? "Un instant…"}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
