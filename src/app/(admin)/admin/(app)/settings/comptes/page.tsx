import type { Metadata } from "next";
import { AccountsManager } from "@/components/admin/settings/accounts-manager";
import { requireOrganizer } from "@/lib/auth/session";
import { formatDate } from "@/lib/dates";
import { listAccounts } from "@/server/services/accounts";

export const metadata: Metadata = { title: "Comptes" };

export default async function AccountsSettingsPage() {
  const { organization, organizer } = await requireOrganizer();
  const accounts = await listAccounts(organization.id, organizer.id);
  return (
    <AccountsManager
      readOnly={organizer.role !== "OWNER"}
      accounts={accounts.map((a) => ({
        id: a.id,
        name: a.name,
        email: a.email,
        role: a.role,
        isActive: a.isActive,
        invitationPending: a.invitationPending,
        isSelf: a.isSelf,
        lastLoginLabel: a.lastLoginAt
          ? formatDate(a.lastLoginAt, organization.timezone, "short")
          : null,
      }))}
    />
  );
}
