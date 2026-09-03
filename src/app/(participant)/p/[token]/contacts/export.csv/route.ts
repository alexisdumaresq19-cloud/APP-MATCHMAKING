import { NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { resolveParticipantAccess } from "@/lib/auth/participant-session";
import { contactsCsv, listContacts } from "@/server/services/contacts";

/** The address book as CSV: company facts and private notes, no personal coordinates. */
export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const access = await resolveParticipantAccess(token);
  if (!access) return new NextResponse("Lien invalide", { status: 401 });
  const rows = await listContacts(access.participant.id);
  await audit({
    organizationId: access.organization.id,
    actorType: "participant",
    actorId: access.participant.id,
    action: "EXPORT",
    entity: "Contact",
    entityId: access.participant.id,
    metadata: { rows: rows.length },
  });
  return new NextResponse(`﻿${contactsCsv(rows)}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="mes-contacts.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
