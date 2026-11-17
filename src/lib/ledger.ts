/**
 * What was left after each day, for the ledger's running balance.
 *
 * `days` are newest first, as the list shows them, each with its net
 * (income less spending; a transfer nets to nothing). The newest day ends
 * on the month's net, the figure on the card above; each older day ends
 * on that less every day after it. Only the days loaded so far are
 * needed, which is why it walks down from the top rather than up from
 * the 1st.
 */
export function balancesAfter(
  days: readonly { key: string; net: bigint }[],
  monthNet: bigint,
): bigint[] {
  const balances: bigint[] = [];
  let running = monthNet;
  for (const day of days) {
    balances.push(running);
    running -= day.net;
  }
  return balances;
}

const WEEKDAY = new Intl.DateTimeFormat("en-IN", {
  timeZone: "UTC",
  weekday: "short",
});

/** "17" and "Tue" for the ledger's date rail, from a `yyyy-mm-dd`. */
export function railDate(day: string): { date: string; weekday: string } {
  const [year, month, date] = day.split("-").map(Number);
  return {
    date: String(date),
    weekday: WEEKDAY.format(new Date(Date.UTC(year!, month! - 1, date!))),
  };
}
