import "server-only";

import { fromDb } from "@/lib/money";
import { getMonthSummary } from "@/lib/queries/transactions";
import { createClient } from "@/lib/supabase/server";

export type MonthRecap = {
  /** First day of the month being summed up, `yyyy-mm-dd`. */
  month: string;
  /** Minor units as text — an RSC payload cannot carry a BigInt. */
  spent: string;
  /** Biggest expense category, or null if nothing was spent. */
  topCategory: { name: string; total: string } | null;
  /**
   * Change against the month before, rounded, or null when there is nothing
   * to compare against — a first month has no story about direction.
   */
  changePercent: number | null;
  /** Budgets that finished the month at or under their limit. */
  budgetsKept: number;
  budgetsTotal: number;
};

const firstOf = (year: number, month: number) =>
  `${year}-${String(month).padStart(2, "0")}-01`;

/**
 * Last month, in four numbers.
 *
 * The end of a month is the one moment somebody will read a summary they did
 * not ask for, so this is what the recap card shows: what went out, where
 * most of it went, whether that was more or less than the month before, and
 * how the budgets finished. Everything comes from the same RPCs the Analysis
 * and Budgets screens use, so the card cannot disagree with the screen it
 * links to.
 *
 * Returns null when the month was empty: a recap of nothing is a card that
 * only takes up space.
 */
export async function getMonthRecap(
  year: number,
  month: number,
): Promise<MonthRecap | null> {
  const supabase = await createClient();

  const start = firstOf(year, month);
  const end = firstOf(month === 12 ? year + 1 : year, month === 12 ? 1 : month + 1);

  const [summary, before, categories, budgets] = await Promise.all([
    getMonthSummary(year, month),
    getMonthSummary(
      month === 1 ? year - 1 : year,
      month === 1 ? 12 : month - 1,
    ),
    supabase.rpc("category_totals", {
      p_from: start,
      // Inclusive of the last day: category_totals takes a closed range, and
      // the first of the next month would pull in a record from it.
      p_to: lastDayOf(end),
      p_kind: "expense",
    }),
    supabase
      .from("budgets")
      .select("category_id, amount")
      .eq("month", start),
  ]);

  if (categories.error) throw new Error(categories.error.message);
  if (budgets.error) throw new Error(budgets.error.message);

  // A month with nothing spent in it has no recap worth showing. Checked
  // after the errors above, so a failed query cannot look like an empty
  // month.
  if (summary.expense === 0n) return null;

  const slices = (categories.data ?? []) as {
    category_id: string;
    name: string;
    total: number | string;
  }[];

  const spentByCategory = new Map(
    slices.map((slice) => [slice.category_id, fromDb(slice.total)]),
  );

  const kept = (budgets.data ?? []).filter(
    (row) => (spentByCategory.get(row.category_id) ?? 0n) <= fromDb(row.amount),
  ).length;

  const top = slices[0];

  return {
    month: start,
    spent: summary.expense.toString(),
    topCategory: top
      ? { name: top.name, total: fromDb(top.total).toString() }
      : null,
    changePercent:
      before.expense > 0n
        ? Math.round(
            Number(((summary.expense - before.expense) * 1000n) / before.expense) /
              10,
          )
        : null,
    budgetsKept: kept,
    budgetsTotal: (budgets.data ?? []).length,
  };
}

/** The day before the first of the next month. */
function lastDayOf(firstOfNext: string): string {
  const date = new Date(`${firstOfNext}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}
