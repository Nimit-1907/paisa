import type { RecurrenceFrequency } from "@/lib/schemas/transactions";

/**
 * The recurrence calendar, in TypeScript.
 *
 * This is the same arithmetic as `recurrence_occurrence()` and
 * `recurrence_after()` in SQL, deliberately duplicated: the database decides
 * what gets *written*, and this decides what the app shows as upcoming before
 * anything is written at all. They have to agree to the day, so
 * recurrence.test.ts asserts the dates recurring.test.sql asserts.
 *
 * Everything here works on `yyyy-mm-dd` strings and integers. No Date
 * arithmetic on wall-clock days: a schedule is a run of calendar dates, and
 * the moment each of them starts depends on a timezone that is none of this
 * file's business (see lib/dates.ts for that half).
 */

export type RecurrenceSchedule = {
  frequency: RecurrenceFrequency;
  /** Every N days/weeks/months/years. */
  interval: number;
  /** `yyyy-mm-dd`: the occurrence the whole schedule is measured from. */
  startDate: string;
  /**
   * The day of the month a monthly or yearly rule aims at, 1–31, clamped to
   * shorter months. Defaults to the start date's own day, which is what the
   * database trigger fills in.
   */
  anchorDay?: number | null;
  /** `yyyy-mm-dd`, inclusive. Null means "until it is switched off". */
  endDate?: string | null;
  /** Occurrence dates the user skipped. */
  skippedDates?: readonly string[];
};

const DAY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Days in a month, so an anchor of 31 can be clamped rather than rolled. */
export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function parts(day: string): { year: number; month: number; date: number } | null {
  const match = DAY_PATTERN.exec(day);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const date = Number(match[3]);

  if (month < 1 || month > 12) return null;
  if (date < 1 || date > daysInMonth(year, month)) return null;

  return { year, month, date };
}

function format(year: number, month: number, date: number): string {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(
    date,
  ).padStart(2, "0")}`;
}

/** `yyyy-mm-dd` a number of days later, on the calendar. */
export function addDays(day: string, days: number): string {
  const at = parts(day);
  if (!at) throw new RangeError(`Not a date: ${day}`);

  const moved = new Date(Date.UTC(at.year, at.month - 1, at.date + days));

  return format(
    moved.getUTCFullYear(),
    moved.getUTCMonth() + 1,
    moved.getUTCDate(),
  );
}

/** Whole days from `from` to `to`; negative when `to` is earlier. */
export function dayDifference(from: string, to: string): number {
  const a = parts(from);
  const b = parts(to);
  if (!a || !b) throw new RangeError("Not a date");

  return Math.round(
    (Date.UTC(b.year, b.month - 1, b.date) -
      Date.UTC(a.year, a.month - 1, a.date)) /
      86_400_000,
  );
}

/**
 * The nth occurrence of a schedule, counting its start date as the 0th.
 *
 * Monthly and yearly land on the anchor day, clamped to the length of the
 * month they fall in, 31 January, 28 February, 31 March, not 31 January,
 * 28 February, 28 March. Stepping from the previous occurrence instead is
 * what causes that drift, and it never recovers.
 */
export function occurrenceOn(schedule: RecurrenceSchedule, n: number): string {
  const start = parts(schedule.startDate);
  if (!start) throw new RangeError(`Not a date: ${schedule.startDate}`);

  const interval = Math.trunc(schedule.interval) || 1;
  const steps = interval * n;

  if (schedule.frequency === "daily") {
    return addDays(schedule.startDate, steps);
  }

  if (schedule.frequency === "weekly") {
    return addDays(schedule.startDate, 7 * steps);
  }

  const months =
    schedule.frequency === "monthly"
      ? start.month - 1 + steps
      : start.month - 1 + 12 * steps;

  const year = start.year + Math.floor(months / 12);
  // JS % keeps the sign of the dividend, and a schedule can be walked
  // backwards while an estimate settles.
  const month = ((months % 12) + 12) % 12 + 1;

  const anchor = schedule.anchorDay ?? start.date;
  const date = Math.min(anchor, daysInMonth(year, month));

  return format(year, month, date);
}

/**
 * The first date on the schedule that is on or after `from`.
 *
 * The estimate is exact for daily and weekly and at most one step out for
 * monthly and yearly, a clamped month can land before the anchor, so both
 * directions are walked afterwards. This is the pure schedule: it knows
 * nothing about skipped occurrences or an end date, exactly like
 * `recurrence_after()` in SQL.
 */
export function scheduledOnOrAfter(
  schedule: RecurrenceSchedule,
  from: string,
): string {
  const start = parts(schedule.startDate);
  const target = parts(from);
  if (!start || !target) throw new RangeError("Not a date");

  const interval = Math.trunc(schedule.interval) || 1;

  let n: number;
  switch (schedule.frequency) {
    case "daily":
      n = Math.trunc(dayDifference(schedule.startDate, from) / interval);
      break;
    case "weekly":
      n = Math.trunc(dayDifference(schedule.startDate, from) / (7 * interval));
      break;
    case "monthly":
      n = Math.trunc(
        (target.year * 12 +
          target.month -
          (start.year * 12 + start.month)) /
          interval,
      );
      break;
    case "yearly":
      n = Math.trunc((target.year - start.year) / interval);
      break;
  }

  n = Math.max(0, n);
  let date = occurrenceOn(schedule, n);

  while (date < from) {
    n += 1;
    date = occurrenceOn(schedule, n);
  }

  while (n > 0 && occurrenceOn(schedule, n - 1) >= from) {
    n -= 1;
    date = occurrenceOn(schedule, n);
  }

  return date;
}

/**
 * The next occurrence the user should actually expect on or after `from`:
 * on the schedule, not skipped, not past the end date.
 *
 * Null means the schedule has nothing left, it ended, or every remaining
 * occurrence was skipped.
 */
export function nextOccurrence(
  schedule: RecurrenceSchedule,
  from: string,
): string | null {
  const skipped = new Set(schedule.skippedDates ?? []);
  let date = scheduledOnOrAfter(schedule, from);

  // Bounded rather than `while (true)`: a run of skipped dates is short in
  // practice, and a schedule whose interval was somehow zero must not spin.
  for (let guard = 0; guard < skipped.size + 1; guard += 1) {
    if (schedule.endDate && date > schedule.endDate) return null;
    if (!skipped.has(date)) return date;
    date = scheduledOnOrAfter(schedule, addDays(date, 1));
  }

  return null;
}

/**
 * The next `count` occurrences from `from` onwards.
 *
 * Used for the rule detail page ("upcoming next 5") and for the Upcoming
 * strip on Records, which shows what is due in the next seven days without
 * writing any of it.
 */
export function upcoming(
  schedule: RecurrenceSchedule,
  count: number,
  from: string = schedule.startDate,
): string[] {
  const dates: string[] = [];
  let cursor = from;

  for (let taken = 0; taken < count; taken += 1) {
    const next = nextOccurrence(schedule, cursor);
    if (!next) break;

    dates.push(next);
    cursor = addDays(next, 1);
  }

  return dates;
}

/** Every occurrence between two dates, inclusive, the Upcoming window. */
export function occurrencesBetween(
  schedule: RecurrenceSchedule,
  from: string,
  to: string,
  limit = 60,
): string[] {
  const dates: string[] = [];
  let cursor = from;

  while (dates.length < limit) {
    const next = nextOccurrence(schedule, cursor);
    if (!next || next > to) break;

    dates.push(next);
    cursor = addDays(next, 1);
  }

  return dates;
}

/* ------------------------------------------------------------- wording --- */

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
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

/** The weekday a schedule falls on: 0 = Sunday. */
export function weekdayOf(day: string): number {
  const at = parts(day);
  if (!at) throw new RangeError(`Not a date: ${day}`);
  return new Date(Date.UTC(at.year, at.month - 1, at.date)).getUTCDay();
}

/**
 * How a rule reads in a list: "Every 2 weeks on Mon", "Monthly on day 31".
 *
 * Built here rather than in the component so the phrasing is tested, and so
 * the list, the detail page and the Upcoming strip cannot drift apart.
 */
export function describeSchedule(schedule: RecurrenceSchedule): string {
  const interval = Math.trunc(schedule.interval) || 1;
  const start = parts(schedule.startDate);
  const anchor = schedule.anchorDay ?? start?.date ?? 1;

  switch (schedule.frequency) {
    case "daily":
      return interval === 1 ? "Daily" : `Every ${interval} days`;

    case "weekly": {
      const weekday = WEEKDAYS[weekdayOf(schedule.startDate)];
      return interval === 1
        ? `Weekly on ${weekday}`
        : `Every ${interval} weeks on ${weekday}`;
    }

    case "monthly":
      return interval === 1
        ? `Monthly on day ${anchor}`
        : `Every ${interval} months on day ${anchor}`;

    case "yearly": {
      const month = MONTHS[(start?.month ?? 1) - 1];
      return interval === 1
        ? `Yearly on ${anchor} ${month}`
        : `Every ${interval} years on ${anchor} ${month}`;
    }
  }
}
