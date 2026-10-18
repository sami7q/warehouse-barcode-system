import type { MetadataRoute } from "next";

/**
 * Makes the app installable ("Add to Home Screen"). On iPhone this is
 * required for push notifications at all: iOS only exposes Web Push to a
 * site launched from the home screen, never inside a Safari tab.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "إدارة المخازن",
    short_name: "المخازن",
    description: "نظام إدارة المخازن والباركود",
    lang: "ar",
    dir: "rtl",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#E8EBF2",
    theme_color: "#101C36",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
