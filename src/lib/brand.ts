import type { CSSProperties } from "react";

const HEX_RE = /^#?([0-9a-f]{6})$/i;

export function normalizeHexColor(input: string | null | undefined, fallback: string): string {
  const match = HEX_RE.exec((input ?? "").trim());
  return match ? `#${match[1].toUpperCase()}` : fallback;
}

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** WCAG relative luminance of a #RRGGBB color. */
export function relativeLuminance(hex: string): number {
  const normalized = normalizeHexColor(hex, "#000000").slice(1);
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** White or near-black text, whichever contrasts best with the given background. */
export function readableTextColor(hex: string): "#FFFFFF" | "#111827" {
  const luminance = relativeLuminance(hex);
  const contrastWithWhite = 1.05 / (luminance + 0.05);
  const contrastWithBlack = (luminance + 0.05) / 0.05;
  return contrastWithWhite >= contrastWithBlack ? "#FFFFFF" : "#111827";
}

export const DEFAULT_PRIMARY = "#1F3864";
export const DEFAULT_ACCENT = "#F2C94C";

export type BrandColors = { primaryColor: string; accentColor: string };

/** CSS custom properties consumed by the `brand*` Tailwind colors (see globals.css). */
export function brandStyle(colors: BrandColors): CSSProperties {
  const primary = normalizeHexColor(colors.primaryColor, DEFAULT_PRIMARY);
  const accent = normalizeHexColor(colors.accentColor, DEFAULT_ACCENT);
  return {
    "--brand-primary": primary,
    "--brand-primary-foreground": readableTextColor(primary),
    "--brand-accent": accent,
    "--brand-accent-foreground": readableTextColor(accent),
  } as CSSProperties;
}
