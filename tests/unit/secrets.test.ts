import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  deriveFallbackSecret,
  resolveAuthSecret,
  resolveParticipantTokenSecret,
  sha256HexPortable,
} from "@/lib/auth/secrets";

describe("secrets", () => {
  it("portable sha256 matches node:crypto", () => {
    for (const input of ["", "abc", "Jumelage — été 2026 · œuvre", "x".repeat(200)]) {
      expect(sha256HexPortable(input)).toBe(
        createHash("sha256").update(input, "utf8").digest("hex"),
      );
    }
  });

  it("prefers explicit variables", () => {
    const env = {
      AUTH_SECRET: "explicit-auth",
      PARTICIPANT_TOKEN_SECRET: "explicit-participant",
      DATABASE_URL: "postgres://x",
    };
    expect(resolveAuthSecret(env)).toBe("explicit-auth");
    expect(resolveParticipantTokenSecret(env)).toBe("explicit-participant");
  });

  it("derives stable, distinct fallbacks from the database URL", () => {
    const env = { NODE_ENV: "test", POSTGRES_URL: "postgres://user:pw@host/db" };
    const auth = resolveAuthSecret(env);
    const participant = resolveParticipantTokenSecret(env);
    expect(auth).toHaveLength(64);
    expect(participant).toHaveLength(64);
    expect(auth).not.toBe(participant);
    expect(resolveAuthSecret(env)).toBe(auth);
    expect(
      deriveFallbackSecret("AUTH_SECRET", { NODE_ENV: "test", POSTGRES_URL: "postgres://other" }),
    ).not.toBe(auth);
    expect(resolveAuthSecret({ NODE_ENV: "test" })).toBeUndefined();
  });
});
