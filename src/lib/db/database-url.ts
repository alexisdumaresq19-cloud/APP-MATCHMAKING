/**
 * Resolves the database connection strings from the environment, accepting the variable names
 * injected by hosting integrations (Vercel Postgres / Neon / Supabase marketplace) so a fresh
 * deployment needs no manual copy of the connection string.
 */
export function resolveDatabaseUrls(env: NodeJS.ProcessEnv = process.env): {
  url: string | undefined;
  directUrl: string | undefined;
} {
  const url =
    env.DATABASE_URL ||
    env.POSTGRES_PRISMA_URL ||
    env.POSTGRES_URL ||
    env.SUPABASE_DB_POOLER_URL ||
    undefined;
  const directUrl =
    env.DIRECT_URL ||
    env.DATABASE_URL_UNPOOLED ||
    env.POSTGRES_URL_NON_POOLING ||
    env.SUPABASE_DB_URL ||
    url;
  return { url, directUrl };
}

/** Writes the resolved values back so Prisma CLI (`env("DATABASE_URL")`) and child processes see them. */
export function applyDatabaseUrlsToEnv(env: NodeJS.ProcessEnv = process.env): void {
  const { url, directUrl } = resolveDatabaseUrls(env);
  if (url && !env.DATABASE_URL) env.DATABASE_URL = url;
  if (directUrl && !env.DIRECT_URL) env.DIRECT_URL = directUrl;
}
