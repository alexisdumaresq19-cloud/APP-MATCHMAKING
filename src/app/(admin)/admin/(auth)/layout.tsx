import type { ReactNode } from "react";
import { AnimatedIcon } from "@/components/ui/animated-icon";
import { PoweredBy } from "@/components/shared/powered-by";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-muted/40 px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex size-16 items-center justify-center rounded-full bg-brand/10">
            <AnimatedIcon name="heart-handshake" size={32} play />
          </div>
          <p className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
            Espace organisateur
          </p>
        </div>
        {children}
        <PoweredBy className="text-center" />
      </div>
    </main>
  );
}
