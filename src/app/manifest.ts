import type { MetadataRoute } from "next";

/** Served at /manifest.webmanifest. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Paisa Expense Tracker",
    short_name: "Paisa",
    description:
      "Track expenses, income and transfers across accounts, set monthly budgets and see where your money goes.",
    lang: "en-IN",
    start_url: "/records",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    // The light theme's page. A manifest is static JSON, so these are the
    // one place the palette is written out rather than read.
    background_color: "#f6f6f4",
    theme_color: "#f6f6f4",
    categories: ["finance", "productivity"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
