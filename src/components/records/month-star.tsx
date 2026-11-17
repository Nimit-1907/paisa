"use client";

import {
  ArrowDownLeft,
  ArrowUpRight,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

import { useFormatMoney } from "@/components/profile-provider";
import { Calendar } from "@/components/shared/calendar";
import { leftLabel } from "@/lib/month-trend";
import { heatLevel } from "@/lib/spend-heat";
import { Amount } from "@/components/shared/amount";
import { HeroSplit, HeroStat } from "@/components/shared/hero-stat";
import { Pill } from "@/components/shared/pill";
import { useCountUp } from "@/lib/motion";

export type DaySpend = {
  /** `yyyy-mm-dd`. */
  on: string;
  /** Minor units as text, an RSC payload cannot carry a BigInt. */
  expense: string;
};

/**
 * The month card: the number you came for, over the shape of the month.
 *
 * One figure in the display face, and under it the month as a calendar,
 * each day shaded darker where more went out. It is the one element in
 * this app that is meant to be recognisable, and it earns the space by
 * being useful: it answers "was it one bad week or all of it?" before any
 * chart is opened, and every day narrows the list to that day.
 *
 * Shading is scaled to the busiest ordinary day rather than the busiest
 * day, so one rent payment does not wash out the other thirty.
 */
export function MonthStar({
  summary,
  days,
  today,
  daysLeft,
  trend,
  pastMonth = null,
  selectedDay = null,
  onChooseDay,
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
  /** "Jul" when the month is over, null while it is running. */
  pastMonth?: string | null;
  /** The day the list is narrowed to, when it is one day. */
  selectedDay?: string | null;
  /** A day tapped on the calendar. */
  onChooseDay?: (day: string) => void;
  /**
   * Drops the accent for the one visit where the recap card is showing.
   * Exactly one bold card per screen; two would be none.
   */
  flat?: boolean;
}) {
  const format = useFormatMoney();
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
      label={leftLabel(net < 0n, pastMonth)}
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
                {/* No sign on nothing: "+₹0" is a gain of zero. */}
                {BigInt(summary.income) > 0n ? "+" : null}
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
                {BigInt(summary.expense) > 0n ? "−" : null}
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
         * The month as a calendar, each day shaded by what went out, and
         * each one a 44px button that narrows the list to that day. It
         * replaced thirty bars that were decoration only: at 328px each
         * bar was seven pixels wide, too small to tap. Days still to come
         * are there but cannot be chosen.
         */
        <Calendar
          className="-mx-4 mt-3"
          month={days[0]!.on.slice(0, 8) + "01"}
          selected={selectedDay ?? ""}
          today={today}
          min={days[0]!.on}
          max={today && today < days.at(-1)!.on ? today : days.at(-1)!.on}
          heat={Object.fromEntries(
            days.map((day) => [
              day.on,
              heatLevel(Number(BigInt(day.expense)), scale),
            ]),
          )}
          describeDay={(day) => {
            const spent = BigInt(
              days.find((each) => each.on === day)?.expense ?? "0",
            );
            return spent > 0n
              ? `, spent ${format(spent, { paise: "trim" })}`
              : ", nothing spent";
          }}
          gridLabel="Spending by day"
          onSelect={(day) => onChooseDay?.(day)}
        />
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
