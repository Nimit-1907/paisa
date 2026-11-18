"use client";

import { useFirstFill } from "@/lib/motion";
import { cn } from "@/lib/utils";

/**
 * How much of a budget has gone.
 *
 * Three states, and the thresholds carry more than colour: under 80% the
 * fill is plain ink, 80–100% it becomes butter *with an ink border*, and
 * over 100% rose *with an ink border*. The border is what makes the warning
 * legible without colour vision, the two tints are pale by design, so on
 * their own they would be two slightly different light greys.
 *
 * With `pace` (a budget, in a month that has begun) the warning is about
 * speed rather than size: green while spending is behind the month, butter
 * once it is ahead of it, rose over the limit, and a tick on the track
 * where the month has got to. 74% of Groceries on the 18th is ahead of a
 * month that is 60% gone, and that is worth saying before 80%.
 *
 * Fills once on first view, 500ms, and only on the way in: a bar that
 * re-ran its fill on every render would redraw itself whenever something
 * unrelated on the screen changed. It animates from zero rather than from
 * its last value because the figure beside it counts up at the same time,
 * and the two moving together is what makes the pair read as one fact.
 */
export function ProgressBar({
  percent,
  label,
  pace = null,
  className,
}: {
  /** 0–100+. Values over 100 clamp the bar but change its colour. */
  percent: number;
  /** Names the bar for a screen reader; the visible text is beside it. */
  label: string;
  /** How far through its month the budget is, 0–100. See above. */
  pace?: number | null;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(100, percent));
  // Zero for a frame, then the real width, and straight to it under
  // reduced motion, with no flash of full in between. See lib/motion.ts.
  const width = useFirstFill(clamped);
  const over = percent > 100;
  const close =
    pace === null
      ? percent >= 80 && percent <= 100
      : percent > pace && percent <= 100;
  const onTrack = pace !== null && !over && !close;
  const tick = pace !== null && pace > 0 && pace < 100 ? pace : null;

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={Math.round(percent)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn(
        "bg-surface-muted relative h-2 overflow-hidden rounded-full",
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
              : onTrack
                ? "bg-income"
                : "bg-ink",
        )}
        style={{ width: `${width}%` }}
      />
      {tick !== null ? (
        <span
          aria-hidden="true"
          className="bg-text-secondary absolute inset-y-0 w-0.5"
          style={{ left: `${tick}%` }}
        />
      ) : null}
    </div>
  );
}
