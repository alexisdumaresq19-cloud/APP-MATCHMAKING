"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { audit } from "@/lib/audit";
import { resolveParticipantAccess } from "@/lib/auth/participant-session";
import { prisma } from "@/lib/db/prisma";
import { logger } from "@/lib/logger";
import { clientIpFromHeaders, rateLimit } from "@/lib/rate-limit";
import { fieldErrorsOf, formDataToObject } from "@/lib/validation/common";
import { participantProfileSchema, resendLinkSchema } from "@/lib/validation/registration";
import { currentConsentVersion } from "@/server/services/consent";
import { validSoughtSectorIds } from "@/server/services/sought-sectors";
import { sendParticipantLink } from "@/server/services/participant-emails";
import { GENERIC_ERROR, type ActionState } from "./types";

const INVALID_SESSION =
  "Votre lien n'est plus valide. Demandez un nouveau lien depuis la page d'accueil.";

export async function updateParticipantProfile(
  token: string,
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await resolveParticipantAccess(token);
  if (!context) return { ok: false, formError: INVALID_SESSION };
  const { participant, organization } = context;

  const parsed = participantProfileSchema.safeParse(
    formDataToObject(formData, { arrays: ["offers", "needs", "soughtSectorIds"] }),
  );
  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: fieldErrorsOf(parsed.error),
      formError: "Veuillez corriger les champs indiqués.",
    };
  }
  const data = parsed.data;

  const sector = await prisma.sector.findFirst({
    where: { id: data.sectorId, organizationId: organization.id, isActive: true },
  });
  if (!sector) return { ok: false, fieldErrors: { sectorId: ["Choisissez un secteur."] } };
  const soughtSectorIds = await validSoughtSectorIds(organization.id, data.soughtSectorIds);

  try {
    await prisma.participant.update({
      where: { id: participant.id },
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        jobTitle: data.jobTitle,
        companyName: data.companyName,
        sectorId: sector.id,
        region: data.region,
        city: data.city,
        website: data.website,
        description: data.description,
        offers: data.offers,
        needs: data.needs,
        soughtSectorIds,
      },
    });
  } catch (error) {
    logger.error({ err: error }, "participant profile update failed");
    return { ok: false, formError: GENERIC_ERROR };
  }

  await audit({
    organizationId: organization.id,
    actorType: "participant",
    actorId: participant.id,
    action: "UPDATE",
    entity: "Participant",
    entityId: participant.id,
    metadata: { fields: Object.keys(data) },
  });
  revalidatePath(`/p/${token}`, "layout");
  return { ok: true, message: "Votre profil a été enregistré." };
}

export async function acceptConsent(
  token: string,
  eventId: string | null,
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await resolveParticipantAccess(token);
  if (!context) return { ok: false, formError: INVALID_SESSION };
  const { participant, organization } = context;
  const accepted = formData.get("consent") === "on";
  if (!accepted) {
    return {
      ok: false,
      fieldErrors: { consent: ["Vous devez lire et accepter l'avis de confidentialité."] },
    };
  }
  const headerList = await headers();
  const consentVersion = currentConsentVersion(organization);
  try {
    await prisma.$transaction([
      prisma.consentLog.create({
        data: {
          participantId: participant.id,
          eventId,
          consentVersion,
          consentText: organization.consentText,
          ipAddress: clientIpFromHeaders(headerList),
          userAgent: headerList.get("user-agent")?.slice(0, 500) ?? null,
        },
      }),
      prisma.participant.update({
        where: { id: participant.id },
        data: { consentedAt: new Date() },
      }),
    ]);
  } catch (error) {
    logger.error({ err: error }, "consent acceptance failed");
    return { ok: false, formError: GENERIC_ERROR };
  }
  await audit({
    organizationId: organization.id,
    actorType: "participant",
    actorId: participant.id,
    action: "CONSENT",
    entity: "Participant",
    entityId: participant.id,
    metadata: { consentVersion, eventId },
  });
  revalidatePath(`/p/${token}`, "layout");
  return { ok: true, message: "Merci, votre consentement a été enregistré." };
}

/** From the "expired link" page: sends a fresh link if the email is known (same answer otherwise). */
export async function requestNewParticipantLink(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const headerList = await headers();
  const ip = clientIpFromHeaders(headerList);
  const limit = await rateLimit(`participant-link:${ip}`, { limit: 5, windowSeconds: 3600 });
  if (!limit.ok)
    return { ok: false, formError: "Trop de demandes. Veuillez réessayer dans une heure." };

  const parsed = resendLinkSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsOf(parsed.error) };

  const participants = await prisma.participant.findMany({
    where: { email: parsed.data.email, deletedAt: null },
    include: { organization: true },
    take: 5,
  });
  for (const participant of participants) {
    const { organization, ...rest } = participant;
    await sendParticipantLink({ organization, participant: rest });
  }
  return {
    ok: true,
    message:
      "Si cette adresse est connue, un nouveau lien vient d'être envoyé. Pensez à vérifier vos courriels indésirables.",
  };
}
