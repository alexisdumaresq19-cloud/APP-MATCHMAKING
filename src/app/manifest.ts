import type { MetadataRoute } from "next";

/** Minimal installable PWA (S4-08): a home-screen icon for the organizer's tablet and phone. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Jumelage",
    short_name: "Jumelage",
    description: "Plateforme de jumelage pour événements de réseautage d'affaires.",
    lang: "fr-CA",
    start_url: "/admin",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#1F3864",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
