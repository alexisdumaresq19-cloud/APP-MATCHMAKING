/* Generates the PWA icons (public/icons/*.png) without any image library: a brand-colored
 * rounded square with two overlapping white circles (two companies meeting).
 * Run: pnpm tsx scripts/generate-icons.ts
 */
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const PRIMARY = [0x1f, 0x38, 0x64] as const;
const ACCENT = [0xf2, 0xc9, 0x4c] as const;

function crc32(bytes: Uint8Array): number {
  let crc = ~0;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return ~crc >>> 0;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  out.set(Buffer.from(type, "ascii"), 4);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

function encodePng(
  size: number,
  pixel: (x: number, y: number) => [number, number, number, number],
): Buffer {
  const raw = new Uint8Array(size * (size * 4 + 1));
  for (let y = 0; y < size; y += 1) {
    raw[y * (size * 4 + 1)] = 0; // filter: none
    for (let x = 0; x < size; x += 1) {
      const [r, g, b, a] = pixel(x, y);
      const offset = y * (size * 4 + 1) + 1 + x * 4;
      raw[offset] = r;
      raw[offset + 1] = g;
      raw[offset + 2] = b;
      raw[offset + 3] = a;
    }
  }
  const header = new Uint8Array(13);
  const view = new DataView(header.buffer);
  view.setUint32(0, size);
  view.setUint32(4, size);
  header[8] = 8; // bit depth
  header[9] = 6; // RGBA
  const signature = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([
    signature,
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", new Uint8Array(0)),
  ]);
}

/** Two circles meeting, on a rounded square (or a full square for the maskable variant). */
function icon(size: number, maskable: boolean): Buffer {
  const radius = maskable ? 0 : size * 0.22;
  const center = size / 2;
  const circleR = size * (maskable ? 0.17 : 0.2);
  const dx = size * (maskable ? 0.11 : 0.13);
  const inside = (x: number, y: number): boolean => {
    if (radius === 0) return true;
    const cx = Math.min(Math.max(x, radius), size - radius);
    const cy = Math.min(Math.max(y, radius), size - radius);
    return (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2;
  };
  return encodePng(size, (x, y) => {
    const px = x + 0.5;
    const py = y + 0.5;
    if (!inside(px, py)) return [0, 0, 0, 0];
    const left = (px - (center - dx)) ** 2 + (py - center) ** 2 <= circleR ** 2;
    const right = (px - (center + dx)) ** 2 + (py - center) ** 2 <= circleR ** 2;
    if (left && right) return [ACCENT[0], ACCENT[1], ACCENT[2], 255];
    if (left || right) return [255, 255, 255, 255];
    return [PRIMARY[0], PRIMARY[1], PRIMARY[2], 255];
  });
}

const dir = path.resolve(process.cwd(), "public/icons");
mkdirSync(dir, { recursive: true });
writeFileSync(path.join(dir, "icon-192.png"), icon(192, false));
writeFileSync(path.join(dir, "icon-512.png"), icon(512, false));
writeFileSync(path.join(dir, "icon-512-maskable.png"), icon(512, true));
writeFileSync(path.join(dir, "apple-touch-icon.png"), icon(180, true));
console.log("Icons written to public/icons");
