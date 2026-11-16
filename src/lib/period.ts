import { addDays, dayDifference, daysInMonth, weekdayOf } from "@/lib/recurrence";

/**
 * The window Analysis is looking at.
 *
 * A period is two local calendar days, inclusive of both, plus enough about
 * where it came from to step it and to name it. Everything here is pure
 * `yyyy-mm-dd` string arithmetic, which instant a day starts at is
 * lib/dates.ts's business, and the RPCs do that conversion themselves.
 */

export const PERIOD_KINDS = ["week", "month", "year", "custom"] as const;
export type PeriodKind = (typeof PERIOD_KINDS)[number];

export type Period = {
  kind: PeriodKind;
  /** Inclusive, `yyyy-mm-dd`. */
  from: string;
  /** Inclusive, `yyyy-mm-dd`. */
  to: string;
};

export const PERIOD_LABELS: Record<PeriodKind, string> = {
  week: "Week",
  month: "Month",
  year: "Year",
  custom: "Range",
};

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * How long a custom range may be.
 *
 * Five years of records is already more than a chart can say anything about,
 * and the database refuses more than ten. The sheet checks against this too,
 * so a range is never accepted by the form and then quietly changed.
 */
export const MAX_RANGE_DAYS = 366 * 5;

/**
 * A `yyyy-mm-dd` that is also a real date.
 *
 * The shape alone is not enough: `?d=2026-13-45` matches the pattern and then
 * produces a month that does not exist, which reaches the query as
 * "2026-13-01" and fails there instead of here.
 */
function isValidDay(value: string | undefined): value is string {
  if (!value || !DAY.test(value)) return false;

  const { year, month, date } = parts(value);
  return (
    month >= 1 && month <= 12 && date >= 1 && date <= daysInMonth(year, month)
  );
}

function parts(day: string) {
  return {
    year: Number(day.slice(0, 4)),
    month: Number(day.slice(5, 7)),
    date: Number(day.slice(8, 10)),
  };
}

const firstOfMonth = (year: number, month: number) =>
  `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-01`;

const lastOfMonth = (year: number, month: number) =>
  `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(
    daysInMonth(year, month),
  ).padStart(2, "0")}`;

/**
 * The period of `kind` containing `anchor`.
 *
 * `weekStart` is 0–6 with 0 = Sunday, the same shape `profiles.week_start`
 * and date-fns both use, so a week runs Monday–Sunday for most of the world
 * and Sunday–Saturday where that is the convention.
 */
export function periodContaining(
  kind: Exclude<PeriodKind, "custom">,
  anchor: string,
  weekStart = 1,
): Period {
  const { year, month } = parts(anchor);

  switch (kind) {
    case "week": {
      const offset = (weekdayOf(anchor) - weekStart + 7) % 7;
      const from = addDays(anchor, -offset);
      return { kind, from, to: addDays(from, 6) };
    }
    case "month":
      return {
        kind,
        from: firstOfMonth(year, month),
        to: lastOfMonth(year, month),
      };
    case "year":
      return {
        kind,
        from: `${String(year).padStart(4, "0")}-01-01`,
        to: `${String(year).padStart(4, "0")}-12-31`,
      };
  }
}

/**
 * The same period moved `delta` steps.
 *
 * A custom range moves by its own length, so stepping back from "10–24 Nov"
 * lands on "27 Oct – 9 Nov" rather than on some other fortnight.
 */
export function shiftPeriod(
  period: Period,
  delta: number,
  weekStart = 1,
): Period {
  if (delta === 0) return period;

  switch (period.kind) {
    case "week":
      return periodContaining("week", addDays(period.from, 7 * delta), weekStart);
    case "month": {
      const { year, month } = parts(period.from);
      const total = year * 12 + (month - 1) + delta;
      return periodContaining(
        "month",
        firstOfMonth(Math.floor(total / 12), (((total % 12) + 12) % 12) + 1),
        weekStart,
      );
    }
    case "year": {
      const { year } = parts(period.from);
      return periodContaining("year", `${year + delta}-01-01`, weekStart);
    }
    case "custom": {
      const span = dayDifference(period.from, period.to) + 1;
      return {
        kind: "custom",
        from: addDays(period.from, span * delta),
        to: addDays(period.to, span * delta),
      };
    }
  }
}

/**
 * The period immediately before this one, for "change vs previous".
 *
 * Comparing a part-month against a whole one would make every month look like
 * a saving until the 28th, so this is only ever used with the caller knowing
 * what it is comparing.
 */
export function previousPeriod(period: Period, weekStart = 1): Period {
  return shiftPeriod(period, -1, weekStart);
}

/**
 * Days or months on the x-axis.
 *
 * A year of daily bars at 360px is 365 slivers; a fortnight of monthly bars
 * is one. The cut is at about a quarter, past which days stop being legible
 * and months start being informative.
 */
export function bucketFor(period: Period): "day" | "month" {
  if (period.kind === "year") return "month";
  if (period.kind === "month" || period.kind === "week") return "day";
  return dayDifference(period.from, period.to) > 92 ? "month" : "day";
}

/** How many days the period covers, both ends included. */
export function periodLength(period: Period): number {
  return dayDifference(period.from, period.to) + 1;
}

/** Whether `day` falls inside the period. */
export function periodContains(period: Period, day: string): boolean {
  return day >= period.from && day <= period.to;
}

/**
 * Reads a period off the URL, falling back to the month the user is in.
 *
 * Everything is checked rather than trusted: the parameters come from the
 * address bar, and a range of several centuries is not worth a query.
 */
export function parsePeriod(
  params: {
    p?: string;
    d?: string;
    from?: string;
    to?: string;
  },
  today: string,
  weekStart = 1,
): Period {
  const kind = (PERIOD_KINDS as readonly string[]).includes(params.p ?? "")
    ? (params.p as PeriodKind)
    : "month";

  if (kind === "custom") {
    const from = isValidDay(params.from) ? params.from : null;
    const to = isValidDay(params.to) ? params.to : null;

    if (from && to && from <= to && dayDifference(from, to) <= MAX_RANGE_DAYS) {
      return { kind: "custom", from, to };
    }

    return periodContaining("month", today, weekStart);
  }

  const anchor = isValidDay(params.d) ? params.d : today;

  // A period that has not started yet has nothing in it; the arrows clamp to
  // the one containing today for the same reason.
  const period = periodContaining(kind, anchor, weekStart);
  return period.from > today
    ? periodContaining(kind, today, weekStart)
    : period;
}

/** The URL parameters that describe a period. */
export function periodParams(period: Period): Record<string, string> {
  return period.kind === "custom"
    ? { p: "custom", from: period.from, to: period.to }
    : { p: period.kind, d: period.from };
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const FULL_MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/**
 * What the period is called in the header: "November 2026", "10 – 16 Nov",
 * "2026", "10 Nov – 3 Dec 2026".
 */
export function periodLabel(period: Period): string {
  const from = parts(period.from);
  const to = parts(period.to);

  if (period.kind === "month") {
    return `${FULL_MONTHS[from.month - 1]} ${from.year}`;
  }

  if (period.kind === "year") return String(from.year);

  const sameYear = from.year === to.year;
  const sameMonth = sameYear && from.month === to.month;

  if (sameMonth) {
    return `${from.date} – ${to.date} ${MONTHS[to.month - 1]} ${to.year}`;
  }

  if (sameYear) {
    return `${from.date} ${MONTHS[from.month - 1]} – ${to.date} ${
      MONTHS[to.month - 1]
    } ${to.year}`;
  }

  return `${from.date} ${MONTHS[from.month - 1]} ${from.year} – ${to.date} ${
    MONTHS[to.month - 1]
  } ${to.year}`;
}

/**
 * Whether a bucket is only partly inside the period.
 *
 * A custom range starting mid-October gives a month bucket labelled
 * "October" that actually holds the 15th onwards, and a bar that claims to be
 * a whole month when it is half of one is a quiet lie.
 */
export function bucketIsPartial(
  period: Period,
  day: string,
  bucket: "day" | "month",
): boolean {
  if (bucket === "day") return false;

  const { year, month } = parts(day);
  const start = firstOfMonth(year, month);
  const end = lastOfMonth(year, month);

  return start < period.from || end > period.to;
}

/** A bucket's own label on an axis: "14" for a day, "Nov" for a month. */
export function bucketLabel(day: string, bucket: "day" | "month"): string {
  const { month, date } = parts(day);
  return bucket === "day" ? String(date) : MONTHS[month - 1];
}

/** The longer form a tooltip can afford: "Sat 14 Nov" / "November 2026". */
export function bucketTitle(day: string, bucket: "day" | "month"): string {
  const { year, month, date } = parts(day);

  if (bucket === "month") return `${FULL_MONTHS[month - 1]} ${year}`;

  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return `${weekdays[weekdayOf(day)]} ${date} ${MONTHS[month - 1]}`;
}
