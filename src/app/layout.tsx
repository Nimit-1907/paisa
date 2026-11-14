import type { Metadata, Viewport } from "next";

import { Inter } from "next/font/google";

import { ServiceWorkerUpdates } from "@/components/pwa/service-worker-updates";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { SITE, siteOrigin } from "@/lib/site";
import { SPLASHES, splashHref, splashMedia } from "@/lib/splash";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  // Absolute URLs for the canonical links, the sitemap and the OG card are
  // resolved against this; without it Next warns and falls back to localhost.
  metadataBase: new URL(siteOrigin()),
  title: {
    default: `${SITE.name} — ${SITE.tagline}`,
    template: `%s · ${SITE.name}`,
  },
  description: SITE.description,
  applicationName: "Paisa",
  appleWebApp: {
    capable: true,
    title: "Paisa",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  // Phone numbers in amounts/notes should not become tel: links on iOS.
  formatDetection: { telephone: false },
};

/**
 * Reads the stored choice, falls back to the system, and sets the class.
 *
 * Wrapped in try/catch because localStorage throws rather than returning null
 * in a locked-down browser, and a theme is not worth a blank page.
 */
const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("theme")||"system";var d=t==="dark"||(t==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d);document.documentElement.style.colorScheme=d?"dark":"light"}catch(e){}})()`;

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Lets the layout paint under the notch/home bar; `env(safe-area-inset-*)`
  // keeps the nav, FAB and sheets clear of them.
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8fafc" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1016" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    // The font variable lives on <html> so the `font-sans` utility (applied
    // to html in globals.css) can resolve it.
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        {/*
          Written here rather than left to `metadata.manifest`, which Next
          streams into the body: Chrome only resolves <link rel="manifest">
          from inside <head>, so the streamed one leaves the app
          uninstallable — the manifest is fetchable, and the browser never
          asks for it.
        */}
        {/*
          The theme, decided before anything paints.

          next-themes ships this same logic, but it renders where the provider
          is — inside <body>, after the element carrying the background
          colour. Running it here makes the first paint already the right
          theme rather than a white flash corrected a moment later. The
          provider re-applies the same value afterwards, which is a no-op.

          Passed as a text child rather than as raw inner HTML: React writes a
          script's children out unescaped, so no HTML sink is involved.
        */}
        <script>{THEME_SCRIPT}</script>

        <link rel="manifest" href="/manifest.webmanifest" />

        {/*
          iOS launch screens. Safari matches on exact device dimensions, so
          each size needs its own link; the images are generated rather than
          committed. Without them an installed app opens on a white gap.
        */}
        {SPLASHES.map((splash) => (
          <link
            key={splashHref(splash)}
            rel="apple-touch-startup-image"
            media={splashMedia(splash)}
            href={splashHref(splash)}
          />
        ))}
      </head>
      <body className="antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster position="top-center" />
          <ServiceWorkerUpdates />
        </ThemeProvider>
      </body>
    </html>
  );
}
