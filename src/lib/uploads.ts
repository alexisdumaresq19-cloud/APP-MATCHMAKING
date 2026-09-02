/** Server-side checks for uploaded images (section 9: MIME sniffed, size capped, name regenerated). */

export const LOGO_MAX_BYTES = 2 * 1024 * 1024;

export type ImageKind = "image/png" | "image/jpeg" | "image/webp";

/**
 * Detects PNG, JPEG and WebP from the file's first bytes. The declared `type` of the upload is
 * never trusted; SVG is refused on purpose (it can carry scripts).
 */
export function sniffImageType(bytes: Uint8Array): ImageKind | null {
  if (bytes.length < 12) return null;
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (png.every((value, index) => bytes[index] === value)) return "image/png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.subarray(from, to));
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  return null;
}

export type LogoCheck =
  { ok: true; mimeType: ImageKind; bytes: Uint8Array } | { ok: false; error: string };

/** Validates a logo upload: non-empty, at most 2 MB, real PNG/JPEG/WebP content. */
export function checkLogoUpload(bytes: Uint8Array): LogoCheck {
  if (bytes.length === 0) return { ok: false, error: "Le fichier est vide." };
  if (bytes.length > LOGO_MAX_BYTES) {
    return { ok: false, error: "Le logo doit faire 2 Mo ou moins." };
  }
  const mimeType = sniffImageType(bytes);
  if (!mimeType) {
    return { ok: false, error: "Format non reconnu : utilisez une image PNG, JPEG ou WebP." };
  }
  return { ok: true, mimeType, bytes };
}

export function logoExtension(mimeType: ImageKind): string {
  return mimeType === "image/png" ? "png" : mimeType === "image/jpeg" ? "jpg" : "webp";
}
