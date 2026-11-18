import { dayDifference } from "@/lib/recurrence";
import { type DateFormat, dateFormat } from "@/lib/date-format";

/**
 * How a calendar day reads next to today: "tomorrow", "in 3 days",
 * "on Sat 21 Nov".
 *
 * Both arguments are local calendar days (`yyyy-mm-dd`) already placed in the
 * user's timezone, so the formatting is done in UTC: reading them in the
 * user's own zone would shift them back a day for anyone behind UTC, which is
 * how a bill due tomorrow ends up labelled "today".
 */

let formatter: DateFormat | null = null;

/** Just the date: "Sat 21 Nov". */
export function dayLabel(day: string): string {
  // Built once: Intl formatters are expensive, and this one never varies.
  formatter ??= dateFormat({
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short",
  });

  return formatter.format(new Date(`${day}T00:00:00Z`));
}

/**
 * The distance on its own: "today", "in 9 days", "3 days ago".
 *
 * For places that already show the date and only need to say how far off it
 * is, repeating the date there reads as a stutter.
 */
export function daysAway(day: string, today: string): string {
  const difference = dayDifference(today, day);

  if (difference === 0) return "today";
  if (difference === 1) return "tomorrow";
  if (difference === -1) return "yesterday";

  return difference > 0 ? `in ${difference} days` : `${-difference} days ago`;
}

/**
 * The same thing for a place with no date beside it, so anything further off
 * than a few days falls back to naming the day.
 */
export function relativeDay(day: string, today: string): string {
  const difference = dayDifference(today, day);

  return difference > -2 && difference < 7
    ? daysAway(day, today)
    : `on ${dayLabel(day)}`;
}
