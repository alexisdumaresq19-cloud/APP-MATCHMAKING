import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

/** Serves the organization's logo stored in the database (D-31). Public, cacheable. */
export async function GET(_request: Request, context: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await context.params;
  if (!orgSlug || orgSlug.length > 80) return new NextResponse("Introuvable", { status: 404 });
  const organization = await prisma.organization.findUnique({
    where: { slug: orgSlug },
    select: { logoData: true, logoMimeType: true, updatedAt: true },
  });
  if (!organization?.logoData || !organization.logoMimeType) {
    return new NextResponse("Introuvable", { status: 404 });
  }
  return new NextResponse(new Uint8Array(organization.logoData), {
    headers: {
      "Content-Type": organization.logoMimeType,
      "Content-Length": String(organization.logoData.length),
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      "Last-Modified": organization.updatedAt.toUTCString(),
      "X-Content-Type-Options": "nosniff",
    },
  });
}
