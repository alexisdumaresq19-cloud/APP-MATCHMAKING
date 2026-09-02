import { SignJWT, jwtVerify } from "jose";
import { addDays } from "@/lib/dates";

const ISSUER = "matchmaking-events";
const AUDIENCE = "participant";

export type ParticipantTokenPurpose = "access" | "register";

export type ParticipantTokenClaims = {
  participantId: string;
  organizationId: string;
  tokenVersion: number;
  purpose: ParticipantTokenPurpose;
  eventId?: string;
};

function secretKey(secret?: string): Uint8Array {
  const value = secret ?? process.env.PARTICIPANT_TOKEN_SECRET;
  if (!value || value.length < 32) {
    throw new Error("PARTICIPANT_TOKEN_SECRET manquant ou trop court (32 caractères minimum)");
  }
  return new TextEncoder().encode(value);
}

export async function signParticipantToken(
  claims: ParticipantTokenClaims,
  options: { expiresAt: Date; secret?: string },
): Promise<string> {
  return new SignJWT({
    org: claims.organizationId,
    v: claims.tokenVersion,
    purpose: claims.purpose,
    ...(claims.eventId ? { eventId: claims.eventId } : {}),
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(claims.participantId)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(Math.floor(options.expiresAt.getTime() / 1000))
    .sign(secretKey(options.secret));
}

/** Returns the claims if the signature and expiration are valid; null otherwise. */
export async function verifyParticipantToken(
  token: string,
  options: { secret?: string } = {},
): Promise<ParticipantTokenClaims | null> {
  if (!token || token.length > 2048) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(options.secret), {
      issuer: ISSUER,
      audience: AUDIENCE,
      algorithms: ["HS256"],
    });
    if (
      typeof payload.sub !== "string" ||
      typeof payload.org !== "string" ||
      typeof payload.v !== "number" ||
      (payload.purpose !== "access" && payload.purpose !== "register")
    ) {
      return null;
    }
    return {
      participantId: payload.sub,
      organizationId: payload.org,
      tokenVersion: payload.v,
      purpose: payload.purpose,
      eventId: typeof payload.eventId === "string" ? payload.eventId : undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Access links live until the end of the participant's last event + 30 days,
 * and at least 60 days from now.
 */
export function participantAccessExpiry(
  lastEventEnd: Date | null | undefined,
  now = new Date(),
): Date {
  const minimum = addDays(now, 60);
  if (!lastEventEnd) return minimum;
  const afterEvent = addDays(lastEventEnd, 30);
  return afterEvent > minimum ? afterEvent : minimum;
}

export const REGISTER_LINK_DAYS = 7;
