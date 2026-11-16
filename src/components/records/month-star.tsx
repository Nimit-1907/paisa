"use client";

import {
  ArrowDownLeft,
  ArrowUpRight,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

import { Amount } from "@/components/shared/amount";
import { HeroSplit, HeroStat } from "@/components/shared/hero-stat";
import { Pill } from "@/components/shared/pill";
import { useCountUp } from "@/lib/motion";
import { cn } from "@/lib/utils";

export type DaySpend = {
  /** `yyyy-mm-dd`. */
  on: string;
  /** Minor units as text, an RSC payload cannot carry a BigInt. */
  expense: string;
};

/**
 * The month card: the number you came for, over the shape of the month.
 *
 * One figure in the display face, and under it a thin bar for every day,
 * taller where more went out. It is the one element in this app that is
 * meant to be recognisable, and it earns the space by being useful: the
 * shape answers "was it one bad week or all of it?" before any chart is
 * opened, and every bar is a link to that day's records.
 *
 * Bars are scaled to the busiest ordinary day rather than the busiest day,
 * so one rent payment does not flatten the other thirty. The outlier runs
 * off the top, which is also the honest way to draw it.
 */
export function MonthStar({
  summary,
  days,
  today,
  daysLeft,
  trend,
  flat = false,
}: {
  summary: { income: string; expense: string; net: string };
  days: DaySpend[];
  /** Today where the user is, `yyyy-mm-dd`. Empty for a past month. */
  today: string;
  /** Days remaining in the month, for the per-day line. 0 for a past one. */
  daysLeft: number;
  /** "12% less than Oct", when there is a previous month to compare with. */
  trend?: { text: string; better: boolean } | null;
  /**
   * Drops the accent for the one visit where the recap card is showing.
   * Exactly one bold card per screen; two would be none.
   */
  flat?: boolean;
}) {
  const net = BigInt(summary.net);
  const shown = useCountUp(net < 0n ? -net : net);

  const amounts = days.map((day) => Number(BigInt(day.expense)));
  const scale = ordinaryPeak(amounts);

  // Only while the month is still running, and only when there is something
  // left: "₹0 a day for 0 days" is arithmetic, not help.
  const perDay = daysLeft > 0 && net > 0n ? net / BigInt(daysLeft) : null;

  return (
    <HeroStat
      flat={flat}
      // Not "Left to spend": that is the Budgets figure, what is left of
      // the limits. This one is income less spending, a different number,
      // and the two screens disagreeing under one name read as a bug.
      label={net < 0n ? "Overspent this month" : "Left this month"}
      trend={
        trend ? (
          <Pill tone={trend.better ? "income" : "expense"}>
            {trend.better ? (
              <TrendingDown className="size-3" aria-hidden="true" />
            ) : (
              <TrendingUp className="size-3" aria-hidden="true" />
            )}
            {trend.text}
          </Pill>
        ) : null
      }
      value={
        <span className={net < 0n ? "text-expense" : undefined}>
          <Amount value={shown} signDisplay="never" whole />
        </span>
      }
      helper={
        perDay ? (
          <>
            <Amount value={perDay} signDisplay="never" whole /> a day ·{" "}
            {daysLeft} {daysLeft === 1 ? "day" : "days"} left
          </>
        ) : null
      }
      split={
        <>
          <HeroSplit
            tint="bg-tint-mint"
            icon={<ArrowDownLeft className="size-3.5" />}
            label="Income"
            value={
              <span className="text-income">
                +
                <Amount
                  value={BigInt(summary.income)}
                  signDisplay="never"
                  whole
                />
              </span>
            }
          />
          <HeroSplit
            tint="bg-tint-rose"
            icon={<ArrowUpRight className="size-3.5" />}
            label="Spent"
            value={
              <span className="text-expense">
                −
                <Amount
                  value={BigInt(summary.expense)}
                  signDisplay="never"
                  whole
                />
              </span>
            }
          />
        </>
      }
    >
      {days.length > 0 ? (
        /*
         * Decoration, deliberately.
         *
         * Each bar was a link to that day's records, which is a lovely idea
         * and an inaccessible one: thirty bars across 328px makes each
         * target about seven pixels wide, against the 24 that WCAG 2.5.8
         * asks for and the 44 this app promises. The behaviour moved to the
         * day headings in the list below, which are full width.
         *
         * Today's bar is periwinkle *and* carries an ink border. The two
         * fills are 1.03:1 apart in light mode, they differ in hue, not
         * brightness, so without the border, colour vision would be the
         * only way to find today. See src/lib/tokens.test.ts.
         */
        <div aria-hidden="true" className="mt-3 flex h-10 items-end gap-[2px]">
          {days.map((day) => (
            <span
              key={day.on}
              className={cn(
                "flex-1 rounded-[2px]",
                day.on === today
                  ? "bg-accent border-ink border-[1.5px]"
                  : "bg-bar-muted",
              )}
              style={{
                height: `${barHeight(Number(BigInt(day.expense)), scale)}%`,
              }}
            />
          ))}
        </div>
      ) : null}
    </HeroStat>
  );
}

/**
 * The busiest ordinary day: the 85th percentile of the days with spending.
 *
 * The maximum is the wrong scale for this. One rent payment is five times
 * the next biggest day, and against it a month of real spending draws as
 * twenty-nine identical stubs.
 */
export function ordinaryPeak(values: number[]): number {
  const spending = values.filter((value) => value > 0).sort((a, b) => a - b);
  if (spending.length === 0) return 1;

  const index = Math.min(
    Math.floor(spending.length * 0.85),
    spending.length - 1,
  );

  return spending[index] || 1;
}

/** Percent of the track, floored so an empty day is still a mark. */
export function barHeight(spent: number, scale: number): number {
  return Math.min(100, Math.max(8, (spent / scale) * 100));
}
