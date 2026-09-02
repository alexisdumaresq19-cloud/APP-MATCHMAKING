import { describe, expect, it } from "vitest";
import {
  participantAccessExpiry,
  signParticipantToken,
  verifyParticipantToken,
} from "@/lib/auth/participant-token";

const secret = "unit-test-secret-0123456789abcdef0123456789";

describe("participant token", () => {
  it("signs and verifies access claims", async () => {
    const token = await signParticipantToken(
      { participantId: "p1", organizationId: "o1", tokenVersion: 3, purpose: "access" },
      { expiresAt: new Date(Date.now() + 60_000), secret },
    );
    const claims = await verifyParticipantToken(token, { secret });
    expect(claims).toEqual({
      participantId: "p1",
      organizationId: "o1",
      tokenVersion: 3,
      purpose: "access",
      eventId: undefined,
    });
  });

  it("carries the event id for one-click registration links", async () => {
    const token = await signParticipantToken(
      {
        participantId: "p1",
        organizationId: "o1",
        tokenVersion: 0,
        purpose: "register",
        eventId: "e9",
      },
      { expiresAt: new Date(Date.now() + 60_000), secret },
    );
    expect((await verifyParticipantToken(token, { secret }))?.eventId).toBe("e9");
  });

  it("rejects expired, tampered and foreign tokens", async () => {
    const expired = await signParticipantToken(
      { participantId: "p1", organizationId: "o1", tokenVersion: 0, purpose: "access" },
      { expiresAt: new Date(Date.now() - 1000), secret },
    );
    expect(await verifyParticipantToken(expired, { secret })).toBeNull();

    const valid = await signParticipantToken(
      { participantId: "p1", organizationId: "o1", tokenVersion: 0, purpose: "access" },
      { expiresAt: new Date(Date.now() + 60_000), secret },
    );
    expect(await verifyParticipantToken(valid + "x", { secret })).toBeNull();
    expect(
      await verifyParticipantToken(valid, { secret: "another-secret-0123456789abcdef0123" }),
    ).toBeNull();
    expect(await verifyParticipantToken("", { secret })).toBeNull();
  });

  it("computes the access expiry", () => {
    const now = new Date("2026-09-01T00:00:00Z");
    expect(participantAccessExpiry(null, now).toISOString()).toBe("2026-10-31T00:00:00.000Z");
    expect(participantAccessExpiry(new Date("2026-12-01T00:00:00Z"), now).toISOString()).toBe(
      "2026-12-31T00:00:00.000Z",
    );
    expect(participantAccessExpiry(new Date("2026-09-05T00:00:00Z"), now).toISOString()).toBe(
      "2026-10-31T00:00:00.000Z",
    );
  });
});
