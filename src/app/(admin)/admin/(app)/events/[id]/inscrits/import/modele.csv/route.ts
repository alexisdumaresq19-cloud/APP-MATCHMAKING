import { NextResponse } from "next/server";
import { getOrganizerContext } from "@/lib/auth/session";
import { IMPORT_TEMPLATE } from "@/lib/import/registrants";

export async function GET() {
  const session = await getOrganizerContext();
  if (!session) return new NextResponse("Non autorisé", { status: 401 });
  return new NextResponse("﻿" + IMPORT_TEMPLATE.replace(/\n/g, "\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="modele-inscrits.csv"',
      "Cache-Control": "private, no-store",
    },
  });
}
