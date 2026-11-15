"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * How much of a budget has gone.
 *
 * Three states, and the thresholds carry more than colour: under 80% the
 * fill is plain ink, 80–100% it becomes butter *with an ink border*, and
 * over 100% rose *with an ink border*. The border is what makes the warning
 * legible without colour vision — the two tints are pale by design, so on
 * their own they would be two slightly different light greys.
 *
 * Fills once on first view, 500ms. It animates from zero rather than from
 * its last value because the figure beside it counts up at the same time,
 * and the two moving together is what makes the pair read as one fact.
 */
export function ProgressBar({
  percent,
  label,
  className,
}: {
  /** 0–100+. Values over 100 clamp the bar but change its colour. */
  percent: number;
  /** Names the bar for a screen reader; the visible text is beside it. */
  label: string;
  className?: string;
}) {
  const [grown, setGrown] = React.useState(false);

  React.useEffect(() => {
    // Next frame, so the transition has a zero to start from.
    const id = requestAnimationFrame(() => setGrown(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const clamped = Math.max(0, Math.min(100, percent));
  const over = percent > 100;
  const close = percent >= 80 && percent <= 100;

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={Math.round(percent)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn(
        "bg-surface-muted h-2 overflow-hidden rounded-full",
        className,
      )}
    >
      <div
        className={cn(
          "h-full rounded-full",
          "duration-500 ease-out transition-[width] motion-reduce:transition-none",
          over
            ? "bg-tint-rose border-ink border"
            : close
              ? "bg-tint-butter border-ink border"
              : "bg-ink",
        )}
        style={{ width: `${grown ? clamped : 0}%` }}
      />
    </div>
  );
}
