import type { Metadata } from "next";

import Link from "next/link";

import { EmptyIllustration } from "@/components/shared/empty-illustration";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Offline" };

/**
 * What the service worker serves for a navigation it cannot reach the network
 * for.
 *
 * Deliberately static and outside the app shell: it has to be precached at
 * build time, which means it cannot read cookies, call Supabase, or render
 * anything that depends on who is signed in.
 *
 * It is honest about the limitation rather than pretending — this app's
 * writes all go through Server Actions, so without a network there is nothing
 * useful to offer beyond "the pages you have already opened still work".
 */
export default function OfflinePage() {
  return (
    <main className="pt-safe pb-safe flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <EmptyIllustration art="lost" />

      <h1 className="font-display mt-2 text-3xl tracking-[-0.02em]">
        You are offline
      </h1>

      <p className="text-text-secondary mt-2 max-w-[42ch] text-sm">
        Paisa needs a connection to load your records. Pages you have already
        opened will still work — this one could not be reached.
      </p>

      <Button asChild size="touch" className="mt-7 px-5">
        <Link href="/records">Try again</Link>
      </Button>
    </main>
  );
}
