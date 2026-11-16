"use client";

import { useLinkStatus } from "next/link";

import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * A nav link's icon that shows the tap was heard.
 *
 * Records has no loading skeleton (see `records/page.tsx`), so between a tap
 * on its dock item and the screen arriving nothing else would move. This is
 * rendered inside the `Link`, which is where `useLinkStatus` reads from, and
 * pulses the icon on a muted wash while that navigation is pending.
 */
export function NavIcon({
  icon: Icon,
  className,
}: {
  icon: LucideIcon;
  className?: string;
}) {
  const { pending } = useLinkStatus();

  return (
    <>
      <span
        aria-hidden="true"
        className={cn(
          "bg-surface-muted pointer-events-none absolute inset-0 -z-10 rounded-[inherit] transition-opacity duration-[120ms] motion-reduce:transition-none",
          pending ? "opacity-100" : "opacity-0",
        )}
      />
      <Icon
        className={cn(className, pending && "animate-pulse")}
        aria-hidden="true"
      />
    </>
  );
}
