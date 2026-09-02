"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { Event, Organization, Participant } from "@prisma/client";
import { audit } from "@/lib/audit";
import {
  appBaseUrl,
  participantAccessUrl,
  resolveRegisterToken,
} from "@/lib/auth/participant-session";
import { REGISTER_LINK_DAYS, signParticipantToken } from "@/lib/auth/participant-token";
import { addDays } from "@/lib/dates";
import { prisma } from "@/lib/db/prisma";
import { logger } from "@/lib/logger";
import { clientIpFromHeaders, rateLimit } from "@/lib/rate-limit";
import { fieldErrorsOf, formDataToObject, type FieldErrors } from "@/lib/validation/common";
import {
  MIN_FORM_SECONDS,
  NEEDS_OR_SECTORS_MESSAGE,
  quickRegistrationSchema,
  registrationSchema,
} from "@/lib/validation/registration";
import { getPublicEvent, registrationAvailability } from "@/server/queries/public";
import { currentConsentVersion } from "@/server/services/consent";
import { registerWithProfile } from "@/server/services/quick-registration";
import { validSoughtSectorIds } from "@/server/services/sought-sectors";
import {
  sendExistingProfileLink,
  sendRegistrationConfirmed,
} from "@/server/services/participant-emails";
import { GENERIC_ERROR, type ActionState } from "./types";

const STEP_FIELDS: string[][] = [
  ["firstName", "lastName", "email", "phone", "jobTitle"],
  ["companyName", "sectorId", "region", "city", "website", "description"],
  ["offers", "soughtSectorIds", "needs", "goalsText", "consent"],
];

function stepOfErrors(fieldErrors: FieldErrors): number {
  const keys = Object.keys(fieldErrors);
  const index = STEP_FIELDS.findIndex((fields) => fields.some((field) => keys.includes(field)));
  return index === -1 ? 0 : index;
}

async function requestMeta() {
  const headerList = await headers();
  return {
    ip: clientIpFromHeaders(headerList),
    userAgent: headerList.get("user-agent")?.slice(0, 500) ?? null,
  };
}

async function notifyExistingParticipant(
  participant: Participant,
  event: Event & { organization: Organization },
  orgSlug: string,
  eventSlug: string,
): Promise<void> {
  const registration = await prisma.eventRegistration.findUnique({
    where: { eventId_participantId: { eventId: event.id, participantId: participant.id } },
  });
  const alreadyRegistered = Boolean(registration && registration.status !== "CANCELLED");
  let actionUrl: string;
  if (alreadyRegistered) {
    actionUrl = await participantAccessUrl(participant);
  } else {
    const token = await signParticipantToken(
      {
        participantId: participant.id,
        organizationId: participant.organizationId,
        tokenVersion: participant.tokenVersion,
        purpose: "register",
        eventId: event.id,
      },
      { expiresAt: addDays(new Date(), REGISTER_LINK_DAYS) },
    );
    actionUrl = `${appBaseUrl()}/e/${orgSlug}/${eventSlug}/inscription-rapide?token=${encodeURIComponent(token)}`;
  }
  await sendExistingProfileLink({
    organization: event.organization,
    event,
    participant,
    alreadyRegistered,
    actionUrl,
  });
}

/** Public registration (3-step form). Bound with orgSlug/eventSlug from the page. */
export async function registerToEvent(
  orgSlug: string,
  eventSlug: string,
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const thankYouPath = `/e/${orgSlug}/${eventSlug}/merci`;
  const { ip, userAgent } = await requestMeta();

  const limit = await rateLimit(`register:${ip}`, { limit: 10, windowSeconds: 3600 });
  if (!limit.ok) {
    return {
      ok: false,
      formError: "Trop de tentatives depuis votre connexion. Veuillez réessayer dans une heure.",
    };
  }

  const raw = formDataToObject(formData, { arrays: ["offers", "needs", "soughtSectorIds"] });
  const honeypotFilled = typeof raw.companyFax === "string" && raw.companyFax.length > 0;
  const startedAt = Number(raw.formStartedAt);
  const tooFast =
    !Number.isFinite(startedAt) ||
    startedAt <= 0 ||
    Date.now() - startedAt < MIN_FORM_SECONDS * 1000;
  if (honeypotFilled || tooFast) {
    logger.warn({ ip, honeypotFilled, tooFast }, "registration rejected by anti-spam checks");
    redirect(thankYouPath); // identical outcome for bots
  }

  const parsed = registrationSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors = fieldErrorsOf(parsed.error);
    return {
      ok: false,
      fieldErrors,
      step: stepOfErrors(fieldErrors),
      formError: "Veuillez corriger les champs indiqués.",
    };
  }
  const data = parsed.data;

  const event = await getPublicEvent(orgSlug, eventSlug);
  if (!event || event.status === "DRAFT")
    return { ok: false, formError: "Cet événement est introuvable." };
  if (!registrationAvailability(event).open) {
    return { ok: false, formError: "Les inscriptions à cet événement sont fermées." };
  }
  const organization = event.organization;

  const sector = await prisma.sector.findFirst({
    where: { id: data.sectorId, organizationId: organization.id, isActive: true },
  });
  if (!sector) return { ok: false, fieldErrors: { sectorId: ["Choisissez un secteur."] }, step: 1 };
  const soughtSectorIds = await validSoughtSectorIds(organization.id, data.soughtSectorIds);
  if (!soughtSectorIds.length && !data.needs.length) {
    return { ok: false, fieldErrors: { soughtSectorIds: [NEEDS_OR_SECTORS_MESSAGE] }, step: 2 };
  }

  const existing = await prisma.participant.findUnique({
    where: { organizationId_email: { organizationId: organization.id, email: data.email } },
  });
  if (existing && !existing.deletedAt) {
    // Do not reveal that the email is known: send a link by email and show the same success page.
    await notifyExistingParticipant(existing, event, orgSlug, eventSlug);
    redirect(thankYouPath);
  }

  const consentVersion = currentConsentVersion(organization);
  let participant: Participant;
  try {
    participant = await prisma.$transaction(async (tx) => {
      const created = await tx.participant.create({
        data: {
          organizationId: organization.id,
          email: data.email,
          firstName: data.firstName,
          lastName: data.lastName,
          phone: data.phone,
          companyName: data.companyName,
          jobTitle: data.jobTitle,
          sectorId: sector.id,
          website: data.website,
          city: data.city,
          region: data.region,
          offers: data.offers,
          needs: data.needs,
          soughtSectorIds,
          description: data.description,
          consentedAt: new Date(),
        },
      });
      await tx.eventRegistration.create({
        data: {
          eventId: event.id,
          participantId: created.id,
          source: "PLATFORM",
          offersSnapshot: data.offers,
          needsSnapshot: data.needs,
          soughtSectorsSnapshot: soughtSectorIds,
          goalsText: data.goalsText,
        },
      });
      await tx.consentLog.create({
        data: {
          participantId: created.id,
          eventId: event.id,
          consentVersion,
          consentText: organization.consentText,
          ipAddress: ip,
          userAgent,
        },
      });
      return created;
    });
  } catch (error) {
    logger.error({ err: error }, "registration failed");
    return { ok: false, formError: GENERIC_ERROR };
  }

  await audit({
    organizationId: organization.id,
    actorType: "participant",
    actorId: participant.id,
    action: "CREATE",
    entity: "EventRegistration",
    entityId: event.id,
    metadata: { eventId: event.id, source: "PLATFORM" },
  });
  await audit({
    organizationId: organization.id,
    actorType: "participant",
    actorId: participant.id,
    action: "CONSENT",
    entity: "Participant",
    entityId: participant.id,
    metadata: { consentVersion, eventId: event.id },
  });
  await sendRegistrationConfirmed({
    organization,
    event,
    participant,
    sectorName: sector.name,
    offers: data.offers,
    needs: data.needs,
    soughtSectorNames: await sectorNames(soughtSectorIds),
  });

  redirect(thankYouPath);
}

async function sectorNames(ids: string[]): Promise<string[]> {
  if (!ids.length) return [];
  const rows = await prisma.sector.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true },
  });
  const byId = new Map(rows.map((r) => [r.id, r.name]));
  return ids.map((id) => byId.get(id)).filter((name): name is string => Boolean(name));
}

/** One-click registration for an existing profile (link received by email). */
export async function quickRegister(
  orgSlug: string,
  eventSlug: string,
  token: string,
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const thankYouPath = `/e/${orgSlug}/${eventSlug}/merci`;
  const { ip, userAgent } = await requestMeta();

  const limit = await rateLimit(`quick-register:${ip}`, { limit: 20, windowSeconds: 3600 });
  if (!limit.ok)
    return { ok: false, formError: "Trop de tentatives. Veuillez réessayer plus tard." };

  const event = await getPublicEvent(orgSlug, eventSlug);
  if (!event || event.status === "DRAFT")
    return { ok: false, formError: "Cet événement est introuvable." };
  const participant = await resolveRegisterToken(token, event.id);
  if (!participant) {
    return {
      ok: false,
      formError:
        "Ce lien n'est plus valide. Retournez à la page de l'événement pour vous inscrire.",
    };
  }
  if (!registrationAvailability(event).open) {
    return { ok: false, formError: "Les inscriptions à cet événement sont fermées." };
  }

  const parsed = quickRegistrationSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsOf(parsed.error) };

  let result;
  try {
    result = await registerWithProfile({
      participant,
      event,
      goalsText: parsed.data.goalsText ?? null,
      consentAccepted: parsed.data.consent,
      ip,
      userAgent,
    });
  } catch (error) {
    logger.error({ err: error }, "quick registration failed");
    return { ok: false, formError: GENERIC_ERROR };
  }
  if (!result.ok) {
    if (result.reason === "consent_required") {
      return {
        ok: false,
        fieldErrors: { consent: ["Vous devez lire et accepter l'avis de confidentialité."] },
      };
    }
    return { ok: false, formError: "Les inscriptions à cet événement sont fermées." };
  }
  if (result.alreadyRegistered) redirect(await participantAccessUrl(participant));
  redirect(thankYouPath);
}
