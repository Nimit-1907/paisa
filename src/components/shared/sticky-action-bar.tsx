"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * The strip that holds the action you came to take.
 *
 * Three places need the same thing: the save area of a sheet, the Continue
 * button in onboarding, and the confirm step of an import. All three have to
 * sit above the home bar, above the on-screen keyboard, and above whatever is
 * scrolling underneath — and all three had their own version of it, which is
 * three chances for the keyboard handling to be wrong in two of them.
 *
 * `variant="sheet"` lets go at `lg`, where a sheet has become a centred
 * dialog and there is nothing left to stick to.
 */
export function StickyActionBar({
  variant = "page",
  className,
  children,
}: {
  variant?: "page" | "sheet";
  className?: string;
  children: React.ReactNode;
}) {
  const keyboard = useKeyboardInset();

  return (
    <div
      className={cn(
        "bg-surface sticky bottom-0 z-10 flex gap-2 border-t px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]",
        variant === "sheet" &&
          "lg:static lg:border-0 lg:bg-transparent lg:px-0 lg:pb-0",
        className,
      )}
      // Lifted by however much of the window the on-screen keyboard is
      // covering, so the primary button is never the thing underneath it.
      style={
        keyboard > 0 ? { transform: `translateY(-${keyboard}px)` } : undefined
      }
    >
      {children}
    </div>
  );
}

/**
 * How much of the window the on-screen keyboard is covering.
 *
 * `visualViewport` is the only thing that knows: the layout viewport does not
 * shrink when a keyboard opens on iOS, so a sticky footer sits politely
 * behind it. Zero everywhere there is no keyboard, which includes every
 * desktop browser and every browser without the API.
 */
export function useKeyboardInset(): number {
  const [inset, setInset] = React.useState(0);

  React.useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;

    const update = () => {
      const covered = window.innerHeight - viewport.height - viewport.offsetTop;

      // A few pixels of rounding is not a keyboard.
      setInset(covered > 24 ? Math.round(covered) : 0);
    };

    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);

    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
    };
  }, []);

  return inset;
}
