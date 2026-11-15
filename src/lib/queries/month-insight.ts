import "server-only";

import { describeInsight } from "@/lib/insight";
import { fromDb } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";

/** The first of a month, `yyyy-mm-01`. */
const firstOf = (year: number, month: number) =>
  `${year}-${String(month).padStart(2, "0")}-01`;

/** The last day of the month that starts on `first`. */
function lastDayOf(year: number, month: number): string {
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${String(month).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
}

/**
 * The one sentence that sits under the month card on Records.
 *
 * The same `describeInsight` the Analysis screen uses, fed from the same
 * `category_totals` RPC — so the two screens cannot disagree about which
 * category is biggest or by how much it moved.
 *
 * Returns null rather than a hedge. A month with nothing in it, or a
 * category with no previous month to compare against, has nothing worth a
 * line of its own, and "not enough data yet" under a card that is showing
 * data reads as a fault.
 */
export async function getMonthInsight(
  year: number,
  month: number,
): Promise<string | null> {
  const supabase = await createClient();

  const previous = {
    year: month === 1 ? year - 1 : year,
    month: month === 1 ? 12 : month - 1,
  };

  const [current, before] = await Promise.all([
    supabase.rpc("category_totals", {
      p_from: firstOf(year, month),
      // Inclusive of the last day: `category_totals` takes a closed range,
      // and the first of the next month would pull a record in from it.
      p_to: lastDayOf(year, month),
      p_kind: "expense",
    }),
    supabase.rpc("category_totals", {
      p_from: firstOf(previous.year, previous.month),
      p_to: lastDayOf(previous.year, previous.month),
      p_kind: "expense",
    }),
  ]);

  // Logged, not thrown: this is one decorative sentence on a screen that
  // works without it, and Records is the screen people open most.
  if (current.error || before.error) {
    console.error(
      "[records] month insight unavailable:",
      current.error?.message ?? before.error?.message,
    );
    return null;
  }

  type Slice = { category_id: string; name: string; total: number | string };

  const slices = ((current.data ?? []) as Slice[])
    .map((row) => ({ ...row, amount: fromDb(row.total) }))
    .sort((a, b) => (b.amount > a.amount ? 1 : b.amount < a.amount ? -1 : 0));

  const top = slices[0];
  if (!top) return null;

  const previousTop = ((before.data ?? []) as Slice[]).find(
    (row) => row.category_id === top.category_id,
  );

  return describeInsight({
    kind: "expense",
    periodKind: "month",
    top: { name: top.name, total: top.amount },
    topPrevious: previousTop ? fromDb(previousTop.total) : null,
    total: slices.reduce((sum, row) => sum + row.amount, 0n),
  });
}
