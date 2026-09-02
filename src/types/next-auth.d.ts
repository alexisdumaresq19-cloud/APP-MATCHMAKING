import type { OrganizerRole } from "@prisma/client";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      organizationId: string;
      role: OrganizerRole;
      sessionVersion: number;
    } & DefaultSession["user"];
  }

  interface User {
    organizationId: string;
    role: OrganizerRole;
    sessionVersion: number;
  }
}
