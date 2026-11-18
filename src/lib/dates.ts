import { dateFormat } from "@/lib/date-format";

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
  hour = 0,
  minute = 0,
): Date {
  const guess = Date.UTC(year, month, day, hour, minute);

  // Two passes, not one. The first correction uses the offset at the guess,
  // which is the wall-clock time read as UTC; in a zone behind UTC that can
  // still be on the other side of a daylight-saving change, and the answer
  // comes out an hour off. The second pass measures the offset next to the
  // answer itself.
  const first = guess - offsetMs(new Date(guess), timeZone);
  const second = guess - offsetMs(new Date(first), timeZone);

  return new Date(second);
}

/** Days in a month, so "31 February" is refused rather than rolled over. */
function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Turns a local date and time into the instant it happened.
 *
 * The picker hands over what the user sees, "2026-11-14T13:45", and the
 * profile's timezone decides which moment that was. Reading it as UTC would
 * file an evening in Kolkata under the next day.
 */
export function localToInstant(local: string, timeZone: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(
    local.trim(),
  );
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);

  // The pattern only counts digits. Without these checks "2026-02-31T10:00"
  // and "2026-01-01T99:99" roll over into some other day entirely, and a
  // record lands on a date nobody chose.
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > daysInMonth(year, month)) return null;
  if (hour > 23 || minute > 59) return null;

  const date = fromWallClock(year, month - 1, day, timeZone, hour, minute);

  return Number.isNaN(date.getTime()) ? null : date;
}

/** The inverse: an instant as the `yyyy-mm-ddThh:mm` a picker wants. */
export function instantToLocal(
  instant: Date | string,
  timeZone: string,
): string {
  const date = typeof instant === "string" ? new Date(instant) : instant;

  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  );

  const hour = parts.hour === "24" ? "00" : parts.hour;

  return `${parts.year}-${parts.month}-${parts.day}T${hour}:${parts.minute}`;
}

/** Year and month as the user's calendar sees them right now. */
export function currentMonth(timeZone: string, now: Date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);

  const lookup = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );

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

/**
 * The next occurrence of a repeat, on the user's local calendar.
 *
 * Month ends are clamped the way Postgres clamps them, 31 January plus a
 * month is 28 February, and plus two months is back to 31 March, so this
 * agrees with recurrence_occurrence() in SQL. Letting a Date roll over
 * instead would turn 31 January into 3 March and drift from there.
 */
export function nextRecurrence(
  localDay: string,
  frequency: "daily" | "weekly" | "monthly" | "yearly",
  interval: number,
): string {
  const [year, month, day] = localDay.split("-").map(Number);

  const afterDays = (days: number) =>
    new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);

  const afterMonths = (months: number) => {
    const total = year * 12 + (month - 1) + months;
    const targetYear = Math.floor(total / 12);
    const targetMonth = (total % 12) + 1;
    // Day 0 of the next month is the last day of this one.
    const lastDay = new Date(Date.UTC(targetYear, targetMonth, 0)).getUTCDate();

    return `${targetYear}-${String(targetMonth).padStart(2, "0")}-${String(
      Math.min(day, lastDay),
    ).padStart(2, "0")}`;
  };

  switch (frequency) {
    case "daily":
      return afterDays(interval);
    case "weekly":
      return afterDays(7 * interval);
    case "monthly":
      return afterMonths(interval);
    case "yearly":
      return afterMonths(12 * interval);
  }
}

/**
 * `yyyy-mm-ddThh:mm` for right now, where the user is.
 *
 * The shape a `datetime-local` input wants, and the shape the record sheet
 * carries a draft's date in. It lived inside the sheet until duplicating a
 * record needed the same answer, "the same thing again, now".
 *
 * `en-CA` because its date order is already `yyyy-mm-dd`, and hour 24 is
 * rewritten to 00: `hour12: false` reports midnight as 24 in some
 * environments, which is a valid ISO hour that no input will accept.
 */
export function nowLocal(timeZone: string): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
      .formatToParts(new Date())
      .map((part) => [part.type, part.value]),
  );

  const hour = parts.hour === "24" ? "00" : parts.hour;
  return `${parts.year}-${parts.month}-${parts.day}T${hour}:${parts.minute}`;
}

/**
 * A local `yyyy-mm-ddThh:mm` as a person would say it: "Today, 1:30 pm".
 *
 * For the "When" card on the add sheet, which shows a date the way the rest
 * of the app shows one rather than the way a browser renders
 * `datetime-local`, that is `15/11/2026, 01:30 PM` in one browser and
 * `11/15/2026, 1:30 PM` in the next, and neither says "today".
 *
 * `todayLocal` is passed in rather than read, so this is a pure function of
 * its arguments and can be tested without pretending it is a different day.
 */
export function describeLocal(local: string, todayLocal: string): string {
  const [date, time = "00:00"] = local.split("T");
  const [today] = todayLocal.split("T");
  if (!date || !today) return local;

  const [hourText = "0", minute = "00"] = time.split(":");
  const hour24 = Number(hourText);
  const suffix = hour24 < 12 ? "am" : "pm";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  const clock = `${hour12}:${minute} ${suffix}`;

  if (date === today) return `Today, ${clock}`;

  // One day back from today, in local terms: the date part has no zone, so
  // UTC arithmetic on it cannot drift.
  const [y = "1970", m = "01", d = "01"] = today.split("-");
  const yesterday = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d) - 1))
    .toISOString()
    .slice(0, 10);
  if (date === yesterday) return `Yesterday, ${clock}`;

  const [ry = "1970", rm = "01", rd = "01"] = date.split("-");
  const day = new Date(Date.UTC(Number(ry), Number(rm) - 1, Number(rd)));
  const label = dateFormat({
    day: "numeric",
    month: "short",
    year: ry === y ? undefined : "numeric",
    timeZone: "UTC",
  }).format(day);

  return `${label}, ${clock}`;
}

/**
 * Today as the user's own calendar sees it, `yyyy-mm-dd`.
 *
 * Pure, so it runs on the server and in a client component alike: the
 * Records page and the date pickers must agree on which day is today, and
 * they only can if both ask the profile's time zone, not one the server's
 * and the other the device's.
 */
export function localToday(timeZone: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
