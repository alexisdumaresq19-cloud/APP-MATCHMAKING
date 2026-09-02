import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { appBaseUrl } from "@/lib/auth/participant-session";
import { getOrganizerContext } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getOrganizerContext();
  if (!session) return new NextResponse("Non autorisé", { status: 401 });
  const { id } = await context.params;
  const event = await prisma.event.findFirst({
    where: { id, organizationId: session.organization.id },
    select: { slug: true },
  });
  if (!event) return new NextResponse("Introuvable", { status: 404 });
  const url = `${appBaseUrl()}/e/${session.organization.slug}/${event.slug}`;
  const png = await QRCode.toBuffer(url, {
    type: "png",
    width: 1024,
    margin: 2,
    errorCorrectionLevel: "M",
  });
  return new NextResponse(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `attachment; filename="inscription-${event.slug}.png"`,
      "Cache-Control": "private, no-store",
    },
  });
}
