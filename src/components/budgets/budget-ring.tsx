"use client";

import { useFirstFill } from "@/lib/motion";
import type { BudgetTone } from "@/lib/schemas/budgets";
import { cn } from "@/lib/utils";

const TONE_CLASS: Record<BudgetTone, string> = {
  under: "text-income",
  close: "text-text",
  over: "text-expense",
};

/**
 * The month at a glance.
 *
 * An SVG circle rather than a canvas or a chart library: it is one arc, it has
 * to be sharp at 44px on a phone, and it has to take its colour from the theme
 * so the over-budget red is the same red the amounts use.
 *
 * The ring stops at a full turn. Past 100% the colour and the number below it
 * carry the message — a second lap would just look like a smaller overspend.
 */
export function BudgetRing({
  percent,
  tone,
  size = 112,
  children,
}: {
  /** 0–999; drawn up to 100. */
  percent: number;
  tone: BudgetTone;
  size?: number;
  /** The label in the middle. */
  children?: React.ReactNode;
}) {
  const stroke = size < 80 ? 6 : 9;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  // Fills once, on the way in. The label in the middle is the real number
  // from the first frame; only the arc travels.
  const drawn = useFirstFill(Math.min(100, Math.max(0, percent)));

  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${Math.round(percent)}% of the budget used`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className="stroke-muted"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - drawn / 100)}
          // Starting at the top and going clockwise, which is how everyone
          // reads a dial.
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className={cn(
            "stroke-current motion-safe:transition-[stroke-dashoffset] motion-safe:duration-200",
            TONE_CLASS[tone],
          )}
        />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        {children}
      </div>
    </div>
  );
}

/**
 * The same thing as a bar, for a row in a list.
 *
 * `aria-hidden`: the figures beside it already say spent, budget and what is
 * left, and a screen reader does not need the same thing twice.
 */
export function BudgetBar({
  percent,
  tone,
}: {
  percent: number;
  tone: BudgetTone;
}) {
  const width = useFirstFill(percent);

  return (
    <div
      aria-hidden="true"
      className="bg-surface-muted mt-1.5 h-1.5 w-full overflow-hidden rounded-full"
    >
      <div
        className={cn(
          "h-full rounded-full motion-safe:transition-[width] motion-safe:duration-200",
          tone === "under" && "bg-income",
          tone === "close" && "bg-warning",
          tone === "over" && "bg-expense",
        )}
        // A sliver so an almost-untouched budget still reads as started,
        // but nothing at all when nothing has been spent.
        style={{
          width: width === 0 ? "0%" : `${Math.min(100, Math.max(2, width))}%`,
        }}
      />
    </div>
  );
}
