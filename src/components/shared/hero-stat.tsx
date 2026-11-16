"use client";

import * as React from "react";

import { HeroCard } from "@/components/shared/surface";
import { cn } from "@/lib/utils";

/**
 * The one figure a screen is built around, in the Phase 14 anatomy.
 *
 * Reading down the reference: a small label, an optional trend pill on the
 * same line, the number in the display face, a helper line, then anything
 * the screen adds, bars, a progress track, and finally an optional split
 * row divided by hairlines.
 *
 * The number is `font-display` at 42px, which is the one place besides the
 * page title that Bricolage appears. A screen with two of these has two
 * focal points and therefore none, so `HeroCard` carries the accent and
 * every screen uses exactly one.
 */
export function HeroStat({
  label,
  trend,
  value,
  helper,
  split,
  flat = false,
  children,
  className,
}: {
  /**
   * "Left to spend", "Total balance". Sentence case, no.
   *
   * A node rather than a string because the record detail puts the
   * category's tile beside its name here, and that is the same line doing
   * the same job.
   */
  label: React.ReactNode;
  /** Top-right pill: "12% less than Oct". */
  trend?: React.ReactNode;
  /** The figure, already formatted, usually an `<Amount>`. */
  value: React.ReactNode;
  /** One quiet line under the figure. */
  helper?: React.ReactNode;
  /** The two-up row at the bottom, divided by hairlines. */
  split?: React.ReactNode;
  /**
   * Drops the accent, for the rare screen where something else is the one
   * bold card, the month recap on the first open of a new month.
   */
  flat?: boolean;
  /** Bars, a progress track, anything between the helper and the split. */
  children?: React.ReactNode;
  className?: string;
}) {
  const labelId = React.useId();

  return (
    <HeroCard
      flat={flat}
      aria-labelledby={labelId}
      // Padding is on the parts, not the card: the split row runs edge to
      // edge and its hairline has to reach both sides.
      className={cn("p-0", className)}
    >
      <div className="px-4 pt-3.5 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div id={labelId} className="text-text-secondary min-w-0 text-[13px]">
            {label}
          </div>
          {trend}
        </div>

        <p className="font-display mt-0.5 text-[42px] leading-[1.05] tracking-[-0.03em]">
          {value}
        </p>

        {helper ? (
          <p className="text-text-secondary mt-1 text-xs">{helper}</p>
        ) : null}

        {children}
      </div>

      {split ? (
        <div className="divide-hairline grid grid-cols-2 divide-x border-t">
          {split}
        </div>
      ) : null}
    </HeroCard>
  );
}

/**
 * One half of the hero's split row.
 *
 * Income and Spent on Records, in and out on an account. Each carries its
 * own tinted arrow tile, because the two are read as a pair and the tiles
 * are what makes the pairing legible before the numbers are.
 */
export function HeroSplit({
  icon,
  label,
  value,
  tint,
  className,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  /** A `bg-tint-*` class for the icon tile. */
  tint: string;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2.5 px-3 py-2.5", className)}>
      <span
        aria-hidden="true"
        className={cn(
          "text-text flex size-7 shrink-0 items-center justify-center rounded-[9px]",
          tint,
        )}
      >
        {icon}
      </span>

      <span className="min-w-0">
        <span className="text-text-secondary block text-xs">{label}</span>
        <span className="block truncate text-[13px] font-semibold">
          {value}
        </span>
      </span>
    </div>
  );
}
