import type { Metadata, Viewport } from "next";

import { Inter } from "next/font/google";

import { ServiceWorkerUpdates } from "@/components/pwa/service-worker-updates";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Paisa — Expense tracker",
    template: "%s · Paisa",
  },
  description:
    "Track expenses, income and transfers across accounts, set monthly budgets and see where your money goes.",
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
        <link rel="manifest" href="/manifest.webmanifest" />
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
