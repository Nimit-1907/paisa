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
