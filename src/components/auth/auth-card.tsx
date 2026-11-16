import Link from "next/link";

import { IndianRupee, Lock } from "lucide-react";

/**
 * The frame every auth screen shares: brand mark, title, form, footer line.
 *
 * Centred and deliberately empty around the edges. This is the first screen
 * of the app most people will see, and the only things on it are what you
 * came to do and one line saying what happens to what you type.
 */
export function AuthCard({
  title,
  description,
  children,
  footer,
  reassurance = true,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** The privacy line under the form. Off where it would be noise. */
  reassurance?: boolean;
}) {
  return (
    <div className="w-full max-w-sm">
      {/*
        A card, since Phase 14.
 
        The form used to float on the page background with nothing around
        it. On a phone that reads as a page; on a laptop, where the same
        380px sits in the middle of 1400px of empty, it reads as a thing
        that failed to load. The card is the app's own surface at the
        dialog radius, the same shape every sheet opens as.
      */}
      <div className="bg-surface rounded-dialog border p-6">
        <div className="mb-6 flex flex-col items-center text-center">
          <Link
            href="/"
            aria-label="Paisa"
            className="bg-ink text-on-ink rounded-control mb-4 flex size-12 items-center justify-center"
          >
            <IndianRupee className="size-6" aria-hidden="true" />
          </Link>
          <h1 className="font-display text-2xl tracking-[-0.02em]">{title}</h1>
          {description ? (
            <p className="text-text-secondary mt-1.5 text-sm text-balance">
              {description}
            </p>
          ) : null}
        </div>

        {children}

        {reassurance ? (
          <p className="text-text-secondary mt-6 flex items-center justify-center gap-1.5 text-xs">
            <Lock className="size-3 shrink-0" aria-hidden="true" />
            Your records stay yours. No ads, no trackers.
          </p>
        ) : null}
      </div>

      {footer ? (
        <div className="text-text-secondary mt-4 text-center text-sm">
          {footer}
        </div>
      ) : null}
    </div>
  );
}
