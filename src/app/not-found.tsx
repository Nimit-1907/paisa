import type { Metadata } from "next";

import Link from "next/link";

import { EmptyIllustration } from "@/components/shared/empty-illustration";
import { Button } from "@/components/ui/button";
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
      <EmptyIllustration art="lost" />

      <h1 className="font-display mt-2 text-3xl tracking-[-0.02em]">
        That page has moved on.
      </h1>

      <p className="text-text-secondary mt-2 text-sm text-pretty">
        The link might be old, or the thing it pointed at might have been
        deleted. Your records are where you left them.
      </p>

      <Button asChild size="touch" className="mt-7 px-5">
        <Link href={HOME_PATH}>Back to your records</Link>
      </Button>
    </main>
  );
}
