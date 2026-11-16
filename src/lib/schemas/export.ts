import { z } from "zod";

import { localToInstant } from "@/lib/dates";
import { dayDifference } from "@/lib/recurrence";

/**
 * The range an export covers.
 *
 * Both ends are local calendar days and both are inclusive, "1 to 30
 * November" means all of the 30th, and the span is capped, because an export
 * is a file somebody waits for and a request for every record since 1970 is
 * one nobody is waiting for on purpose.
 */

const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date like 2026-11-30");

export const MAX_EXPORT_DAYS = 366 * 3;

export const exportRangeSchema = z
  .object({ from: day, to: day })
  .refine((value) => value.from <= value.to, {
    path: ["to"],
    message: "The start is after the end.",
  })
  .refine(
    (value) => dayDifference(value.from, value.to) <= MAX_EXPORT_DAYS,
    { path: ["to"], message: "Export at most three years at a time." },
  );

export type ExportRange = z.infer<typeof exportRangeSchema>;

/**
 * The half-open instant range the queries compare against.
 *
 * The upper bound is the start of the day after `to`, not `to` plus 24 hours:
 * a daylight-saving day is 23 or 25 hours long, and the difference is a
 * record silently missing from the file.
 */
export function rangeToInstants(
  range: ExportRange,
  timeZone: string,
): { startsAt: string; endsAt: string } | null {
  const start = localToInstant(`${range.from}T00:00`, timeZone);
  const [year, month, date] = range.to.split("-").map(Number);
  const nextDay = new Date(Date.UTC(year, month - 1, date + 1))
    .toISOString()
    .slice(0, 10);
  const end = localToInstant(`${nextDay}T00:00`, timeZone);

  if (!start || !end) return null;

  return { startsAt: start.toISOString(), endsAt: end.toISOString() };
}
