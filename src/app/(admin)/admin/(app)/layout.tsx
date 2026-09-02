import type { ReactNode } from "react";
import { AdminShell } from "@/components/admin/layout/admin-shell";
import { requireOrganizer } from "@/lib/auth/session";

export default async function AdminAppLayout({ children }: { children: ReactNode }) {
  const { organizer, organization } = await requireOrganizer();
  return (
    <AdminShell organization={organization} organizer={organizer}>
      {children}
    </AdminShell>
  );
}
