/**
 * Month boundaries in the user's timezone.
 *
 * Every "this month" query compares a timestamptz column against an instant,
 * and the instant a month starts at depends on where the user is: 1 November
 * in Kolkata begins at 18:30 UTC on 31 October. Comparing against UTC
 * midnight would file an evening purchase under the wrong month, which is
 * exactly the kind of error nobody notices until the totals are wrong.
 *
 * The database does this with `at time zone` (see month_summary); this is the
 * same arithmetic for queries the client builds.
 */

/** How far `timeZone` is from UTC at a given instant, in milliseconds. */
function offsetMs(instant: Date, timeZone: string): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const parts = Object.fromEntries(
    formatter.formatToParts(instant).map((part) => [part.type, part.value]),
  );

  const wallClockAsUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second),
  );

  return wallClockAsUtc - instant.getTime();
}

/** The instant at which a given wall-clock time in `timeZone` occurs. */
function fromWallClock(
  year: number,
  month: number,
  day: number,
  timeZone: string,
): Date {
  const guess = Date.UTC(year, month, day);
  // One correction is enough: the offset at the guess is the offset at the
  // answer unless a DST change lands inside the few hours between them.
  return new Date(guess - offsetMs(new Date(guess), timeZone));
}

/** Year and month as the user's calendar sees them right now. */
export function currentMonth(timeZone: string, now: Date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);

  const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return {
    year: Number(lookup.year),
    /** 1-12, as a human would say it. */
    month: Number(lookup.month),
  };
}

export type MonthRange = {
  /** Inclusive lower bound, as an ISO instant. */
  startsAt: string;
  /** Exclusive upper bound. */
  endsAt: string;
  /** The month's first day, as `yyyy-mm-dd` in the user's calendar. */
  monthStart: string;
};

/**
 * The half-open range covering a month in `timeZone`.
 *
 *   monthRange(2026, 11, "Asia/Kolkata")
 *   → 2026-10-31T18:30:00.000Z … 2026-11-30T18:30:00.000Z
 */
export function monthRange(
  year: number,
  month: number,
  timeZone: string,
): MonthRange {
  const start = fromWallClock(year, month - 1, 1, timeZone);
  const end = fromWallClock(year, month, 1, timeZone);

  return {
    startsAt: start.toISOString(),
    endsAt: end.toISOString(),
    monthStart: `${year}-${String(month).padStart(2, "0")}-01`,
  };
}

/** The range covering the month the user is currently in. */
export function currentMonthRange(
  timeZone: string,
  now: Date = new Date(),
): MonthRange {
  const { year, month } = currentMonth(timeZone, now);
  return monthRange(year, month, timeZone);
}
