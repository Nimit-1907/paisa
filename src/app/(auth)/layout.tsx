import Link from "next/link";

import { AppPreview } from "@/components/marketing/app-preview";

/**
 * The signed-out frame.
 *
 * One centred card on a phone. From `lg` up it splits: the app on the left,
 * the form on the right — because a laptop has 1,280 pixels and a form that
 * is 384 of them floating in the middle of them reads as an error page. The
 * left half is also the only place a signed-out visitor sees what they are
 * signing in to.
 *
 * Phase 14 took the grain off it. The texture was there to stop a large
 * empty surface reading as unfinished; a hairline split and a card on each
 * side does that without a background image.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-dvh overflow-hidden">
      <div className="relative grid min-h-dvh lg:grid-cols-2">
        {/*
          Decorative and hidden below lg: it is the same preview the landing
          page shows, and on a phone the form is the whole point of the
          screen.
        */}
        <aside className="bg-surface-muted hidden flex-col items-center justify-center gap-8 border-r p-10 lg:flex">
          <Link href="/" className=" rounded-control flex items-center gap-2 ">
            <span className="font-display text-text text-xl">Paisa</span>
          </Link>

          <AppPreview />

          <p className="text-text-secondary max-w-[34ch] text-center text-sm text-balance">
            Four taps to log a spend. No bank login, no ads, and your records
            stay yours.
          </p>
        </aside>

        <main className="flex flex-col items-center justify-center px-4 pt-[max(2.5rem,env(safe-area-inset-top))] pb-[max(2.5rem,env(safe-area-inset-bottom))]">
          {children}
        </main>
      </div>
    </div>
  );
}
