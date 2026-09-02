import { z } from "zod";
import { applyDatabaseUrlsToEnv } from "@/lib/db/database-url";

const emptyToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z
    .string()
    .min(1, "DATABASE_URL est requis (ou POSTGRES_URL via une intégration d'hébergement)"),
  AUTH_SECRET: z.string().min(16, "AUTH_SECRET doit contenir au moins 16 caractères").optional(),
  AUTH_URL: z.url().optional(),
  PARTICIPANT_TOKEN_SECRET: z
    .string()
    .min(32, "PARTICIPANT_TOKEN_SECRET doit contenir au moins 32 caractères")
    .optional(),
  RESEND_API_KEY: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  EMAIL_FROM: z.string().min(3).default("Jumelage <no-reply@localhost>"),
  EMAIL_TRANSPORT: z.enum(["resend", "smtp", "console"]).optional(),
  UPLOAD_PROVIDER: z.enum(["supabase", "uploadthing"]).default("supabase"),
  SUPABASE_URL: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  SUPABASE_BUCKET: z.string().default("logos"),
  UPSTASH_REDIS_REST_URL: z.string().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
  SENTRY_DSN: z.string().optional(),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  APP_BASE_URL: z.url().default("http://localhost:3000"),
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

export function getEnv(): Env {
  if (cached) return cached;
  applyDatabaseUrlsToEnv();
  const raw: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(process.env)) raw[key] = emptyToUndefined(value);
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const details = z.flattenError(parsed.error).fieldErrors as Record<
      string,
      string[] | undefined
    >;
    const lines = Object.entries(details)
      .map(([key, errors]) => `  - ${key}: ${(errors ?? []).join(", ")}`)
      .join("\n");
    throw new Error(`Variables d'environnement invalides :\n${lines}`);
  }
  cached = parsed.data;
  return cached;
}

/** Lazy accessor so importing this module never throws at build time. */
export const env: Env = new Proxy({} as Env, {
  get(_target, prop: string) {
    return getEnv()[prop as keyof Env];
  },
});

export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}
