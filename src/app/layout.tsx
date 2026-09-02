import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

// Self-hosted Inter (variable weight). No third-party font requests on public pages.
const inter = localFont({
  src: "../styles/fonts/inter-latin-wght-normal.woff2",
  weight: "100 900",
  style: "normal",
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Jumelage", template: "%s · Jumelage" },
  description: "Plateforme de jumelage pour événements de réseautage d'affaires.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1F3864",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr-CA" className={inter.variable}>
      <body className="min-h-dvh bg-background font-sans text-foreground antialiased">
        {children}
        <Toaster position="top-center" richColors closeButton />
      </body>
    </html>
  );
}
