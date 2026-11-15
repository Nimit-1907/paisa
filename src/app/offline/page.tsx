import type { Metadata } from "next";

import Link from "next/link";

import { CloudOff } from "lucide-react";

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
      <span className="bg-surface-muted text-text-secondary mb-5 flex size-14 items-center justify-center rounded-card">
        <CloudOff className="size-7" aria-hidden="true" />
      </span>

      <h1 className="text-xl font-semibold tracking-tight">You are offline</h1>

      <p className="text-text-secondary mt-2 max-w-[42ch] text-sm">
        Paisa needs a connection to load your records. Pages you have already
        opened will still work — this one could not be reached.
      </p>

      <Link
        href="/records"
        className="bg-ink text-on-ink mt-6 inline-flex h-11 items-center rounded-control px-5 text-sm font-semibold  "
      >
        Try again
      </Link>
    </main>
  );
}
