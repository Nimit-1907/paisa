"use client";

import { ArrowDownLeft, ArrowUpRight } from "lucide-react";

import { useFormatMoney } from "@/components/profile-provider";
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
  const formatMoney = useFormatMoney();
  const net = BigInt(summary.net);
  const shown = useCountUp(net < 0n ? -net : net);

  const amounts = days.map((day) => Number(BigInt(day.expense)));
  const scale = ordinaryPeak(amounts);

  return (
    <section
      aria-label="This month"
      className="bg-card text-card-foreground accent-wash border-border relative overflow-hidden rounded-card border px-4 py-3"
    >
      <Grain />

      <div className="relative">
        <h2 className="text-ink-3 text-label font-semibold tracking-[0.08em] uppercase">
          {net < 0n ? "Overspent this month" : "Left this month"}
        </h2>

        <p
          className={cn(
            "font-display mt-0.5 truncate text-[2.75rem] leading-[1.05]",
            net < 0n ? "text-expense" : "text-ink",
          )}
        >
          {formatMoney(shown, { signDisplay: "never", whole: true })}
        </p>

        <p className="text-ink-2 mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-0.5 text-xs">
          <span className="flex items-center gap-1">
            <ArrowDownLeft className="text-income size-3.5" aria-hidden="true" />
            <span className="amount text-ink font-semibold">
              {formatMoney(BigInt(summary.income), { signDisplay: "never" })}
            </span>
            in
          </span>

          <span className="flex items-center gap-1">
            <ArrowUpRight className="text-expense size-3.5" aria-hidden="true" />
            <span className="amount text-ink font-semibold">
              {formatMoney(BigInt(summary.expense), { signDisplay: "never" })}
            </span>
            out
          </span>
        </p>

        {days.length > 0 ? (
          /*
           * Decoration, deliberately.
           *
           * Each bar was a link to that day's records, which is a lovely
           * idea and an inaccessible one: thirty bars across 328px makes
           * each target about seven pixels wide, against the 24 that WCAG
           * 2.5.8 asks for and the 44 this app promises. axe called it, and
           * it was right — there is no spacing trick that fixes a target
           * that small.
           *
           * The behaviour did not go away, it moved: every day heading in
           * the list below is a link to that day, full width and easy to
           * hit. The shape stays here, where it is read rather than
           * touched, and the list underneath is its text alternative.
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
      </div>
    </section>
  );
}

/**
 * A faint, fixed grain over the card.
 *
 * Only here and on the landing hero. It is what stops a large flat panel
 * reading as a hole in the page, and at this opacity it registers as texture
 * rather than as noise. Inline, so it costs no request; `feTurbulence` with a
 * fixed seed, so it is the same grain every render.
 */
export function Grain({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 size-full opacity-[0.035] dark:opacity-[0.05]",
        className,
      )}
    >
      <filter id="paisa-grain">
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.8"
          numOctaves="3"
          seed="7"
        />
      </filter>
      <rect width="100%" height="100%" filter="url(#paisa-grain)" />
    </svg>
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
