import NextAuth, { type User } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import type { Organizer } from "@prisma/client";
import { authConfig } from "./config";
import { authenticateWithPassword, markLoginSuccess } from "./organizer-login";
import { consumeOrganizerToken } from "./organizer-token";

function toAuthUser(organizer: Organizer): User {
  return {
    id: organizer.id,
    email: organizer.email,
    name: organizer.name,
    organizationId: organizer.organizationId,
    role: organizer.role,
    sessionVersion: organizer.sessionVersion,
  };
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      id: "password",
      name: "Mot de passe",
      credentials: { email: { type: "email" }, password: { type: "password" } },
      async authorize(credentials) {
        const email = typeof credentials?.email === "string" ? credentials.email : "";
        const password = typeof credentials?.password === "string" ? credentials.password : "";
        if (!email || !password) return null;
        const result = await authenticateWithPassword(email, password);
        return result.ok ? toAuthUser(result.organizer) : null;
      },
    }),
    Credentials({
      id: "magic-link",
      name: "Lien de connexion",
      credentials: { token: { type: "text" } },
      async authorize(credentials) {
        const token = typeof credentials?.token === "string" ? credentials.token : "";
        if (!token) return null;
        const organizer = await consumeOrganizerToken(token, "MAGIC_LINK");
        if (!organizer) return null;
        const updated = await markLoginSuccess(organizer, "magic_link");
        return toAuthUser(updated);
      },
    }),
  ],
});
