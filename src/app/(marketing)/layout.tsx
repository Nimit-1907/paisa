import Link from "next/link";

import { IndianRupee } from "lucide-react";

import { SkipLink } from "@/components/layout/skip-link";
import { SITE } from "@/lib/site";

const LINKS = [
  { href: "/features", label: "Features" },
  { href: "/faq", label: "FAQ" },
];

/**
 * The public shell.
 *
 * Server Components only, and no interactivity beyond links: a landing page
 * that ships a component tree to hydrate is a landing page that measures
 * badly for no reason. The nav is markup, the theme follows the system, and
 * there is nothing here to click that is not a destination.
 */
export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SkipLink />

      <header className="bg-background site-header pt-safe sticky top-0 z-30 border-b">
        <div className="mx-auto flex w-full max-w-5xl items-center gap-3 px-4 py-3">
          <Link
            href="/"
            className=" flex min-h-11 items-center gap-2 rounded-lg "
          >
            <span className="bg-ink text-on-ink flex size-8 items-center justify-center rounded-control">
              <IndianRupee className="size-4" aria-hidden="true" />
            </span>
            <span className="font-semibold tracking-tight">{SITE.name}</span>
          </Link>

          <nav aria-label="Main" className="ml-auto">
            <ul className="flex items-center gap-1">
              {LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-text-secondary hoverable:text-text flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold  "
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  href="/login"
                  className="bg-ink text-on-ink hoverable:bg-ink/90 pressable ml-1 flex min-h-11 items-center rounded-full px-4 text-sm font-semibold"
                >
                  Log in
                </Link>
              </li>
            </ul>
          </nav>
        </div>
      </header>

      <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
        {children}
      </main>

      <footer className="pb-safe mt-8 border-t">
        <div className="text-text-secondary mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-6 text-sm">
          <p>
            {SITE.name} — {SITE.tagline}
          </p>
          <nav aria-label="Footer" className="sm:ml-auto">
            <ul className="flex flex-wrap items-center gap-x-4">
              {[...LINKS, { href: "/privacy", label: "Privacy" }].map(
                (link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="hoverable:text-text inline-flex min-h-11 items-center rounded  "
                    >
                      {link.label}
                    </Link>
                  </li>
                ),
              )}
            </ul>
          </nav>
        </div>
      </footer>
    </div>
  );
}
