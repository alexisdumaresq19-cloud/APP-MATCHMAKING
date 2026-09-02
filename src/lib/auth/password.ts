import { hash, verify } from "@node-rs/argon2";

// OWASP-recommended argon2id parameters (19 MiB, 2 iterations, 1 lane).
// The library default algorithm is Argon2id (const enum value 2).
const OPTIONS = { memoryCost: 19_456, timeCost: 2, parallelism: 1 };

export async function hashPassword(password: string): Promise<string> {
  return hash(password, OPTIONS);
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password, OPTIONS);
  } catch {
    return false;
  }
}

/** Used to keep timing similar when no account matches the email. */
const DUMMY_HASH_PROMISE = hash("dummy-password-for-timing", OPTIONS);

export async function burnPasswordVerification(): Promise<void> {
  const dummy = await DUMMY_HASH_PROMISE;
  await verify(dummy, "not-the-password", OPTIONS).catch(() => false);
}
