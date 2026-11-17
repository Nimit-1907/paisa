/**
 * What went out over a month, up to and including one day of it.
 *
 * The trend pill on Records compares this month with last month. On the
 * 17th, the fair comparison is the 1st to the 17th of last month: against
 * the whole of it, this month looks cheaper every day until the last. A
 * `null` cut-off takes the whole month, for a month that is already over.
 */
export function expenseThrough(
  days: readonly { on: string; expense: string }[],
  lastDay: number | null,
): bigint {
  let total = 0n;
  for (const day of days) {
    if (lastDay !== null && Number(day.on.slice(8, 10)) > lastDay) continue;
    total += BigInt(day.expense);
  }
  return total;
}

/**
 * What the trend pill compares against: "1–17 Oct" while the month is
 * running, "Oct" once it is over. `today` is the local date, YYYY-MM-DD.
 */
export function comparedWith(
  year: number,
  month: number,
  today: string,
): string {
  const name = new Intl.DateTimeFormat("en-IN", {
    timeZone: "UTC",
    month: "short",
  }).format(new Date(Date.UTC(year, month - 2, 1)));

  const running =
    Number(today.slice(0, 4)) === year && Number(today.slice(5, 7)) === month;
  if (!running) return name;

  // Day 0 of this month is the last day of the previous one.
  const previousLength = new Date(Date.UTC(year, month - 1, 0)).getUTCDate();
  const through = Math.min(Number(today.slice(8, 10)), previousLength);

  return through === 1 ? `1 ${name}` : `1–${through} ${name}`;
}

/**
 * The month card's label. `pastMonth` is the month's short name when it is
 * over, null while it is running: on July, "Left this month" was about a
 * month the person was not in.
 */
export function leftLabel(
  overspent: boolean,
  pastMonth: string | null,
): string {
  const when = pastMonth ? `in ${pastMonth}` : "this month";
  return `${overspent ? "Overspent" : "Left"} ${when}`;
}
