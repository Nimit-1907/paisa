import { addDays } from "@/lib/recurrence";
import { dateFormat } from "@/lib/date-format";

/**
 * The date presets in the Filter sheet, kept inside the month on screen.
 *
 * The list shows one month. "Last month" or "This year" from November
 * filtered November's records to October's dates and showed nothing, a
 * filter that could only ever be empty. So the presets are days of the
 * month being looked at: Today, Yesterday and the last seven days while it
 * is running, its weeks once it is over. Other months are a tap on the
 * month arrows.
 */
export type DatePreset = { label: string; from: string; to: string };

const SHORT_MONTH = dateFormat({
  timeZone: "UTC",
  month: "short",
});

/** The first day of `month` (`yyyy-mm`) and the last that can be chosen. */
export function monthBounds(
  month: string,
  today: string,
): { min: string; max: string } {
  const [year, number] = month.split("-").map(Number);
  const last = new Date(Date.UTC(year!, number!, 0)).getUTCDate();
  const end = `${month}-${String(last).padStart(2, "0")}`;
  return { min: `${month}-01`, max: today < end ? today : end };
}

export function monthPresets(month: string, today: string): DatePreset[] {
  const { min, max } = monthBounds(month, today);
  const running = today.slice(0, 7) === month;

  if (running) {
    const presets: DatePreset[] = [{ label: "Today", from: today, to: today }];
    const yesterday = addDays(today, -1);
    if (yesterday >= min) {
      presets.push({ label: "Yesterday", from: yesterday, to: yesterday });
    }
    const weekAgo = addDays(today, -6);
    presets.push({
      label: "Last 7 days",
      from: weekAgo < min ? min : weekAgo,
      to: today,
    });
    return presets;
  }

  const [year, number] = month.split("-").map(Number);
  const name = SHORT_MONTH.format(new Date(Date.UTC(year!, number! - 1, 1)));
  const lastDay = Number(max.slice(8, 10));
  const starts = [1, 8, 15, 22];

  return starts.map((start, index) => {
    const end = index === starts.length - 1 ? lastDay : start + 6;
    const day = (n: number) => `${month}-${String(n).padStart(2, "0")}`;
    return { label: `${start}–${end} ${name}`, from: day(start), to: day(end) };
  });
}
