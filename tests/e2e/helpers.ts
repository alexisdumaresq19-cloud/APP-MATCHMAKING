import { PrismaClient } from "@prisma/client";
import { SignJWT } from "jose";

/** Direct database access for E2E setup/assertions (uses DATABASE_URL of the running server). */
export const prisma = new PrismaClient();

export const DEMO_EVENT_PATH = "/e/demo/rencontres-affaires-printemps";
export const OWNER = { email: "owner@demo.local", password: "Demo-1234!" };

export function uniqueEmail(prefix = "e2e"): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@exemple.quebec`;
}

/** Mirrors src/lib/auth/participant-token.ts so tests can open /p/[token] without reading email. */
export async function participantToken(participant: {
  id: string;
  organizationId: string;
  tokenVersion: number;
}): Promise<string> {
  const secret = process.env.PARTICIPANT_TOKEN_SECRET;
  if (!secret) throw new Error("PARTICIPANT_TOKEN_SECRET is required for E2E tests");
  return new SignJWT({
    org: participant.organizationId,
    v: participant.tokenVersion,
    purpose: "access",
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(participant.id)
    .setIssuer("matchmaking-events")
    .setAudience("participant")
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(new TextEncoder().encode(secret));
}

export async function clearRateLimits(): Promise<void> {
  await prisma.rateLimit.deleteMany({});
}
