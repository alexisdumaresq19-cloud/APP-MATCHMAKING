import type { ReactNode } from "react";
import { brandStyle, type BrandColors } from "@/lib/brand";

/** Injects the organization's colors as CSS custom properties for the subtree. */
export function BrandProvider({ colors, children }: { colors: BrandColors; children: ReactNode }) {
  return (
    <div className="contents" style={brandStyle(colors)}>
      {children}
    </div>
  );
}
