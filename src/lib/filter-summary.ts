import type { TransactionFilters } from "@/lib/schemas/transactions";

/**
 * The date filter as one chip.
 *
 * Tapping a day header sets `from` and `to` to the same day. Shown as two
 * chips, "from 16 Nov" and "to 16 Nov", that read as two filters for what
 * is one thought, "16 Nov". `keys` are the URL parameters the chip clears.
 */
export function dateChip(
  from: string | undefined,
  to: string | undefined,
): { keys: string[]; label: string } | null {
  if (from && to) {
    if (from === to)
      return { keys: ["from", "to"], label: `on ${shortDay(from)}` };

    const sameMonth = from.slice(0, 7) === to.slice(0, 7);
    const start = sameMonth
      ? String(Number(from.slice(8, 10)))
      : shortDay(from);
    return { keys: ["from", "to"], label: `${start}–${shortDay(to)}` };
  }
  if (from) return { keys: ["from"], label: `from ${shortDay(from)}` };
  if (to) return { keys: ["to"], label: `to ${shortDay(to)}` };
  return null;
}

/** How many filters are on, for "Filters · 2". A date range is one. */
export function countFilters(filters: TransactionFilters): number {
  let count = 0;
  if (filters.search) count += 1;
  if (filters.types?.length) count += 1;
  if (filters.accountIds?.length) count += 1;
  if (filters.categoryIds?.length) count += 1;
  if (filters.minAmount) count += 1;
  if (filters.maxAmount) count += 1;
  if (filters.from || filters.to) count += 1;
  if (filters.worth) count += 1;
  return count;
}

/** "1 Nov" from a `yyyy-mm-dd`, without pulling in a date library. */
export function shortDay(day: string): string {
  const [year, month, date] = day.split("-").map(Number);
  if (!year || !month || !date) return day;

  // UTC throughout: this is a calendar date with no time in it, and
  // constructing it locally can land on the day before.
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
  }).format(new Date(Date.UTC(year, month - 1, date)));
}
