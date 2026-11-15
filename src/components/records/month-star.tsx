"use client";

import { ArrowDownLeft, ArrowUpRight } from "lucide-react";

import { Amount } from "@/components/shared/amount";
import { HeroStat } from "@/components/shared/hero-stat";
import { useCountUp } from "@/lib/motion";
import { cn } from "@/lib/utils";

export type DaySpend = {
  /** `yyyy-mm-dd`. */
  on: string;
  /** Minor units as text — an RSC payload cannot carry a BigInt. */
  expense: string;
};

/**
 * The month card: the number you came for, over the shape of the month.
 *
 * One figure in the display face, and under it a thin bar for every day,
 * taller where more went out. It is the one element in this app that is
 * meant to be recognisable — and it earns the space by being useful: the
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
}: {
  summary: { income: string; expense: string; net: string };
  days: DaySpend[];
  /** Today where the user is, `yyyy-mm-dd`. Empty for a past month. */
  today: string;
}) {
  const net = BigInt(summary.net);
  const shown = useCountUp(net < 0n ? -net : net);

  const amounts = days.map((day) => Number(BigInt(day.expense)));
  const scale = ordinaryPeak(amounts);

  return (
    <HeroStat
      // The anatomy is `HeroStat`, shared with Budgets and Accounts. What is
      // the month card's own is in here: the bars, and which way the figure
      // reads when the month has gone the wrong way.
      label={net < 0n ? "Overspent this month" : "Left this month"}
      value={
        <span className={net < 0n ? "text-expense" : "text-ink"}>
          <Amount value={shown} signDisplay="never" whole />
        </span>
      }
      legs={
        <p className="text-ink-2 flex flex-wrap items-center gap-x-4 gap-y-0.5 text-xs">
          <span className="flex items-center gap-1">
            <ArrowDownLeft className="text-income size-3.5" aria-hidden="true" />
            <span className="text-ink font-semibold">
              <Amount value={BigInt(summary.income)} signDisplay="never" />
            </span>
            in
          </span>

          <span className="flex items-center gap-1">
            <ArrowUpRight className="text-expense size-3.5" aria-hidden="true" />
            <span className="text-ink font-semibold">
              <Amount value={BigInt(summary.expense)} signDisplay="never" />
            </span>
            out
          </span>
        </p>
      }
    >
      {days.length > 0 ? (
        /*
         * Decoration, deliberately.
         *
         * Each bar was a link to that day's records, which is a lovely idea
         * and an inaccessible one: thirty bars across 328px makes each
         * target about seven pixels wide, against the 24 that WCAG 2.5.8
         * asks for and the 44 this app promises. axe called it, and it was
         * right — there is no spacing trick that fixes a target that small.
         *
         * The behaviour did not go away, it moved: every day heading in the
         * list below is a link to that day, full width and easy to hit. The
         * shape stays here, where it is read rather than touched, and the
         * list underneath is its text alternative.
         */
        <div aria-hidden="true" className="mt-3 flex h-12 items-end gap-[3px]">
          {days.map((day) => (
            <span
              key={day.on}
              className={cn(
                "flex-1 rounded-full",
                day.on === today ? "bg-primary" : "bg-primary/25",
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
