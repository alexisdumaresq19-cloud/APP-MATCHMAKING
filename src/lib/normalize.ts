import { parsePhoneNumberFromString } from "libphonenumber-js/min";

export const TAG_MAX_LENGTH = 40;
export const TAG_MAX_COUNT = 8;

/** Removes diacritics and folds ligatures so "Événementiel" compares equal to "evenementiel". */
export function stripDiacritics(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/œ/g, "oe")
    .replace(/Œ/g, "OE")
    .replace(/æ/g, "ae")
    .replace(/Æ/g, "AE");
}

/** Collapses whitespace and trims; keeps the user's casing and accents for display. */
export function cleanTag(tag: string): string {
  return tag.replace(/\s+/g, " ").trim().slice(0, TAG_MAX_LENGTH);
}

/** Comparison key for a tag: trimmed, lowercase, without accents or punctuation noise. */
export function normalizeTag(tag: string): string {
  return stripDiacritics(cleanTag(tag))
    .toLowerCase()
    .replace(/['’`]/g, " ")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Cleans, drops empties and duplicates (by normalized key), caps the count. */
export function dedupeTags(tags: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of tags) {
    const display = cleanTag(raw);
    const key = normalizeTag(display);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(display);
    if (result.length >= TAG_MAX_COUNT) break;
  }
  return result;
}

export function slugify(input: string): string {
  return stripDiacritics(input)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

const COMPANY_SUFFIXES =
  /\b(inc|inc\.|incorporee|incorporated|ltee|ltd|ltd\.|limitee|limited|senc|s\.e\.n\.c\.|enr|enr\.|corp|corp\.|corporation|co|co\.|llc|sarl|s\.a\.|sa)\b/g;

/** Key used to detect "same company" between two participants. */
export function companyKey(name: string): string {
  return stripDiacritics(name)
    .toLowerCase()
    .replace(/[.,'’`"()&/-]/g, " ")
    .replace(COMPANY_SUFFIXES, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export type PhoneParseResult = { ok: true; value: string | null } | { ok: false };

/** Accepts flexible Canadian formats; returns E.164 (or null for empty input). */
export function parsePhoneE164(input: string | null | undefined): PhoneParseResult {
  const trimmed = (input ?? "").trim();
  if (!trimmed) return { ok: true, value: null };
  const parsed = parsePhoneNumberFromString(trimmed, "CA");
  if (!parsed || !parsed.isValid()) return { ok: false };
  return { ok: true, value: parsed.number };
}

export function formatPhone(e164: string | null | undefined): string {
  if (!e164) return "";
  const parsed = parsePhoneNumberFromString(e164);
  if (!parsed) return e164;
  return parsed.country === "CA" || parsed.country === "US"
    ? parsed.formatNational()
    : parsed.formatInternational();
}

export type WebsiteParseResult = { ok: true; value: string | null } | { ok: false };

/** Normalizes "monsite.com" into "https://monsite.com"; rejects anything that is not http(s). */
export function parseWebsite(input: string | null | undefined): WebsiteParseResult {
  const trimmed = (input ?? "").trim();
  if (!trimmed) return { ok: true, value: null };
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withScheme);
    if (!["http:", "https:"].includes(url.protocol)) return { ok: false };
    if (!url.hostname.includes(".") || /\s/.test(trimmed)) return { ok: false };
    return { ok: true, value: url.toString().replace(/\/$/, "") };
  } catch {
    return { ok: false };
  }
}
