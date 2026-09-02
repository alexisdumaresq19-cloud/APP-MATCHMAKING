import type { ReactNode } from "react";
import { PoweredBy } from "@/components/shared/powered-by";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-muted/40 px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
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
