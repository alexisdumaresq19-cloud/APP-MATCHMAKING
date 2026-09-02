import type { ReactNode } from "react";
import { LogOutIcon } from "lucide-react";
import type { Organization, Organizer } from "@prisma/client";
import { PoweredBy } from "@/components/shared/powered-by";
import { resolveTransportKind } from "@/lib/email/transport";
import { AdminNav } from "./admin-nav";
import { logout } from "@/server/actions/auth";

export function AdminShell({
  organization,
  organizer,
  children,
}: {
  organization: Organization;
  organizer: Organizer;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <aside className="flex flex-col border-b bg-card lg:w-64 lg:shrink-0 lg:border-r lg:border-b-0">
        <div className="flex items-center justify-between gap-3 px-4 py-3 lg:block lg:px-5 lg:py-5">
          <div className="min-w-0">
            <p
              className="truncate text-base font-bold"
              style={{ color: organization.primaryColor }}
            >
              {organization.platformName}
            </p>
            <p className="truncate text-xs text-muted-foreground">{organization.name}</p>
          </div>
          <form action={logout} className="lg:hidden">
            <button
              type="submit"
              className="flex size-10 items-center justify-center rounded-lg hover:bg-muted"
              aria-label="Se déconnecter"
            >
              <LogOutIcon className="size-5" aria-hidden="true" />
            </button>
          </form>
        </div>
        <AdminNav role={organizer.role} showMailbox={resolveTransportKind() === "console"} />
        <div className="mt-auto hidden space-y-3 border-t px-5 py-4 lg:block">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{organizer.name}</p>
            <p className="truncate text-xs text-muted-foreground">{organizer.email}</p>
          </div>
          <form action={logout}>
            <button
              type="submit"
              className="flex min-h-10 items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            >
              <LogOutIcon className="size-4" aria-hidden="true" />
              Se déconnecter
            </button>
          </form>
          <PoweredBy className="text-xs" />
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
        <footer className="px-4 py-4 lg:hidden">
          <PoweredBy className="text-center text-xs" />
        </footer>
      </div>
    </div>
  );
}
