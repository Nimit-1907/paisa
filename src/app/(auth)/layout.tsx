import Link from "next/link";

import { AppPreview } from "@/components/marketing/app-preview";
import { Grain } from "@/components/shared/grain";

/**
 * The signed-out frame.
 *
 * One centred card on a phone. From `lg` up it splits: the app on the left,
 * the form on the right — because a laptop has 1,280 pixels and a form that
 * is 384 of them floating in the middle of them reads as an error page. The
 * left half is also the only place a signed-out visitor sees what they are
 * signing in to.
 *
 * The grain sits over the whole frame rather than over a card. These screens
 * are mostly empty surface, which is what the texture is for.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-dvh overflow-hidden">
      <Grain />

      <div className="relative grid min-h-dvh lg:grid-cols-2">
        {/*
          Decorative and hidden below lg: it is the same preview the landing
          page shows, and on a phone the form is the whole point of the
          screen.
        */}
        <aside className="accent-wash hidden flex-col items-center justify-center gap-8 border-r p-10 lg:flex">
          <Link
            href="/"
            className="focus-visible:ring-ring rounded-control flex items-center gap-2 focus-visible:ring-2 focus-visible:outline-none"
          >
            <span className="font-display text-ink text-xl">Paisa</span>
          </Link>

          <AppPreview />

          <p className="text-ink-2 max-w-[34ch] text-center text-sm text-balance">
            Four taps to log a spend. No bank login, no ads, and your records
            stay yours.
          </p>
        </aside>

        <main className="pt-safe pb-safe flex flex-col items-center justify-center px-4 py-10">
          {children}
        </main>
      </div>
    </div>
  );
}
