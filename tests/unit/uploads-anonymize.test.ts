import { describe, expect, it } from "vitest";
import { anonymizedParticipantData, anonymizedRegistrationData } from "@/lib/anonymize";
import { LOGO_MAX_BYTES, checkLogoUpload, logoExtension, sniffImageType } from "@/lib/uploads";

function withHeader(header: number[], length = 64): Uint8Array {
  const bytes = new Uint8Array(length);
  bytes.set(header);
  return bytes;
}

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG = [0xff, 0xd8, 0xff, 0xe0];
const WEBP = [...Buffer.from("RIFF"), 0, 0, 0, 0, ...Buffer.from("WEBP")];

describe("sniffImageType (S4-01, section 9: MIME sniffed server-side)", () => {
  it("recognizes PNG, JPEG and WebP from the first bytes", () => {
    expect(sniffImageType(withHeader(PNG))).toBe("image/png");
    expect(sniffImageType(withHeader(JPEG))).toBe("image/jpeg");
    expect(sniffImageType(withHeader(WEBP))).toBe("image/webp");
  });

  it("refuses SVG, HTML and anything it cannot identify", () => {
    expect(
      sniffImageType(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>')),
    ).toBeNull();
    expect(sniffImageType(Buffer.from("<html><script>alert(1)</script></html>"))).toBeNull();
    expect(sniffImageType(new Uint8Array(4))).toBeNull();
  });
});

describe("checkLogoUpload", () => {
  it("accepts a real image under the size cap", () => {
    const result = checkLogoUpload(withHeader(PNG));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.mimeType).toBe("image/png");
      expect(logoExtension(result.mimeType)).toBe("png");
    }
  });

  it("rejects empty, oversized and disguised files with a French message", () => {
    expect(checkLogoUpload(new Uint8Array(0))).toEqual({
      ok: false,
      error: "Le fichier est vide.",
    });
    const big = checkLogoUpload(withHeader(PNG, LOGO_MAX_BYTES + 1));
    expect(big.ok).toBe(false);
    if (!big.ok) expect(big.error).toMatch(/2 Mo/);
    const fake = checkLogoUpload(
      Buffer.from("GIF89a not supported here, 64 bytes of padding......."),
    );
    expect(fake.ok).toBe(false);
    if (!fake.ok) expect(fake.error).toMatch(/PNG, JPEG ou WebP/);
  });

  it("maps every accepted type to a regenerated extension", () => {
    expect(logoExtension("image/jpeg")).toBe("jpg");
    expect(logoExtension("image/webp")).toBe("webp");
  });
});

describe("anonymizedParticipantData (Law 25 deletion)", () => {
  it("removes every identifying field and revokes the personal links", () => {
    const data = anonymizedParticipantData("clxyz1234567890abcdef");
    expect(data.email).toBe("supprime-90abcdef@anonyme.invalid");
    expect(data.firstName).toBe("Participant");
    expect(data.lastName).toBe("supprimé");
    expect(data.phone).toBeNull();
    expect(data.website).toBeNull();
    expect(data.description).toBeNull();
    expect(data.offers).toEqual([]);
    expect(data.needs).toEqual([]);
    expect(data.soughtSectorIds).toEqual([]);
    expect(data.sector).toEqual({ disconnect: true });
    expect(data.deletedAt).toBeInstanceOf(Date);
    expect(data.tokenVersion).toEqual({ increment: 1 });
  });

  it("gives two participants distinct placeholder emails (unique constraint per organization)", () => {
    const a = anonymizedParticipantData("participant-aaaaaaaa");
    const b = anonymizedParticipantData("participant-bbbbbbbb");
    expect(a.email).not.toBe(b.email);
  });

  it("clears the free text kept on registrations but nothing that counts for billing", () => {
    expect(anonymizedRegistrationData).toEqual({
      offersSnapshot: [],
      needsSnapshot: [],
      soughtSectorsSnapshot: [],
      goalsText: null,
      notes: null,
    });
    expect(anonymizedRegistrationData).not.toHaveProperty("status");
    expect(anonymizedRegistrationData).not.toHaveProperty("checkedInAt");
  });
});
