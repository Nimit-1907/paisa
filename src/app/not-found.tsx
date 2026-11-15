import type { Metadata } from "next";

import Link from "next/link";

import { Compass } from "lucide-react";

import { HOME_PATH } from "@/lib/routes";

export const metadata: Metadata = { title: "Page not found" };

/**
 * 404.
 *
 * Reached by a mistyped URL, a stale bookmark, or a link to a record that has
 * since been deleted — which is the common one, and the reason this does not
 * say "the page you requested does not exist" in a tone of mild accusation.
 * Something is gone; here is the way back.
 *
 * One action, and it is the same one every system screen offers: Records.
 * A 404 with a nav bar and three suggestions is a maze with a signpost in it.
 */
export default function NotFound() {
  return (
    <main className="pt-safe pb-safe mx-auto flex min-h-dvh w-full max-w-sm flex-col items-center justify-center px-4 text-center">
      <span className="bg-muted text-ink-2 rounded-card mb-5 flex size-14 items-center justify-center">
        <Compass className="size-7" aria-hidden="true" />
      </span>

      <h1 className="font-display text-3xl tracking-tight">
        That page has moved on.
      </h1>

      <p className="text-ink-2 mt-2 text-sm text-pretty">
        The link might be old, or the thing it pointed at might have been
        deleted. Your records are where you left them.
      </p>

      <Link
        href={HOME_PATH}
        className="bg-primary text-primary-foreground hoverable:bg-primary/90 focus-visible:ring-ring rounded-control mt-7 inline-flex min-h-12 items-center px-5 text-sm font-semibold focus-visible:ring-2 focus-visible:outline-none"
      >
        Back to your records
      </Link>
    </main>
  );
}
