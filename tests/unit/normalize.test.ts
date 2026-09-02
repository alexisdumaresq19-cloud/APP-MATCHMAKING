import { describe, expect, it } from "vitest";
import {
  cleanTag,
  companyKey,
  dedupeTags,
  formatPhone,
  normalizeEmail,
  normalizeTag,
  parsePhoneE164,
  parseWebsite,
  slugify,
  stripDiacritics,
} from "@/lib/normalize";

describe("normalize", () => {
  it("strips diacritics and ligatures", () => {
    expect(stripDiacritics("Événementiel — cœur")).toBe("Evenementiel — coeur");
  });

  it("normalizes tags for comparison but keeps display text", () => {
    expect(normalizeTag("  Entretien   Ménager ")).toBe("entretien menager");
    expect(cleanTag("  Entretien   Ménager ")).toBe("Entretien Ménager");
    expect(normalizeTag("L'immobilier!")).toBe("l immobilier");
  });

  it("dedupes tags by normalized key and caps at 8", () => {
    const tags = dedupeTags([
      "Comptabilité",
      "comptabilite",
      " ",
      "Web",
      "web ",
      "a",
      "b",
      "c",
      "d",
      "e",
      "f",
      "g",
    ]);
    expect(tags).toEqual(["Comptabilité", "Web", "a", "b", "c", "d", "e", "f"]);
  });

  it("truncates tags to 40 characters", () => {
    expect(cleanTag("x".repeat(60))).toHaveLength(40);
  });

  it("slugifies French text", () => {
    expect(slugify("Soirée réseautage — Montréal 2026 !")).toBe("soiree-reseautage-montreal-2026");
  });

  it("normalizes emails", () => {
    expect(normalizeEmail("  Alexis@Example.COM ")).toBe("alexis@example.com");
  });

  it("builds a company key ignoring legal suffixes and punctuation", () => {
    expect(companyKey("Les Entreprises Tremblay Inc.")).toBe("les entreprises tremblay");
    expect(companyKey("ENTREPRISES TREMBLAY")).toBe("entreprises tremblay");
    expect(companyKey("Garderie L'Éveil ltée")).toBe("garderie l eveil");
  });

  it("parses Canadian phone numbers into E.164", () => {
    expect(parsePhoneE164("514 555-0199")).toEqual({ ok: true, value: "+15145550199" });
    expect(parsePhoneE164("(418) 555-0123")).toEqual({ ok: true, value: "+14185550123" });
    expect(parsePhoneE164("+1 450 555 0100")).toEqual({ ok: true, value: "+14505550100" });
    expect(parsePhoneE164("")).toEqual({ ok: true, value: null });
    expect(parsePhoneE164("abc")).toEqual({ ok: false });
    expect(parsePhoneE164("123")).toEqual({ ok: false });
  });

  it("formats phone numbers for display", () => {
    expect(formatPhone("+15145550199")).toBe("(514) 555-0199");
    expect(formatPhone(null)).toBe("");
  });

  it("normalizes websites", () => {
    expect(parseWebsite("monsite.com")).toEqual({ ok: true, value: "https://monsite.com" });
    expect(parseWebsite("http://monsite.com/page/")).toEqual({
      ok: true,
      value: "http://monsite.com/page",
    });
    expect(parseWebsite("")).toEqual({ ok: true, value: null });
    expect(parseWebsite("pas un site")).toEqual({ ok: false });
    expect(parseWebsite("ftp://x.com")).toEqual({ ok: false });
  });
});
