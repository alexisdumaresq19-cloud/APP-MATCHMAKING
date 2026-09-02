import type { ReactNode } from "react";
import { requireOrganizer } from "@/lib/auth/session";

/**
 * Chrome-less admin pages: the day-of kiosk (tablet at the door) and the printable table plan.
 * Same authentication as the rest of /admin, no sidebar.
 */
export default async function KioskLayout({ children }: { children: ReactNode }) {
  await requireOrganizer();
  return <main className="min-h-dvh bg-background px-4 py-4 sm:px-6">{children}</main>;
}
