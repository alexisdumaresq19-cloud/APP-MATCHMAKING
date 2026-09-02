import type { NextAuthConfig } from "next-auth";
import type { OrganizerRole } from "@prisma/client";
import { resolveAuthSecret } from "./secrets";

/** Custom claims stored in the session JWT. */
export type AppTokenClaims = {
  organizerId?: string;
  organizationId?: string;
  role?: OrganizerRole;
  sessionVersion?: number;
};

export const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

/**
 * Edge-safe Auth.js configuration (no database access). Providers are added in
 * `src/lib/auth/index.ts`; the middleware uses this object alone.
 */
export const authConfig = {
  secret: resolveAuthSecret(),
  pages: { signIn: "/admin/login", error: "/admin/login" },
  session: { strategy: "jwt", maxAge: SESSION_MAX_AGE_SECONDS, updateAge: 60 * 60 },
  trustHost: true,
  providers: [],
  callbacks: {
    jwt({ token: rawToken, user }) {
      const token = rawToken as typeof rawToken & AppTokenClaims;
      if (user) {
        token.organizerId = user.id;
        token.organizationId = user.organizationId;
        token.role = user.role;
        token.sessionVersion = user.sessionVersion;
        token.name = user.name;
        token.email = user.email;
      }
      return token;
    },
    session({ session, token: rawToken }) {
      const token = rawToken as typeof rawToken & AppTokenClaims;
      if (token.organizerId && token.organizationId && token.role) {
        session.user.id = token.organizerId;
        session.user.organizationId = token.organizationId;
        session.user.role = token.role;
        session.user.sessionVersion = token.sessionVersion ?? 0;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
