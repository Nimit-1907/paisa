import "server-only";

import { fromDb } from "@/lib/money";
import { daysInMonth } from "@/lib/recurrence";
import { createClient } from "@/lib/supabase/server";

export type BudgetLine = {
  categoryId: string;
  name: string;
  icon: string | null;
  /** One of the eight Phase 14 tint keys. */
  tint: string | null;
  /** Minor units as text, an RSC payload cannot carry a BigInt. */
  budget: string;
  spent: string;
};

export type BudgetMonth = {
  lines: BudgetLine[];
  totalBudget: string;
  /** Spent in budgeted categories only, the number the top card compares. */
  totalSpent: string;
  /** Spent across every expense category, budgeted or not. */
  monthExpense: string;
  /** Days remaining in the month, today included. Zero outside this month. */
  daysLeft: number;
  /**
   * How much of the month has gone, 0–100, today included: the share of a
   * budget you could have spent by now and still be on track. 100 for a
   * month that is over, null for one that has not begun.
   */
  pace: number | null;
};

type SummaryCategory = {
  category_id: string;
  name: string;
  icon: string | null;
  tint: string | null;
  total: number | string;
};

const monthStart = (year: number, month: number) =>
  `${year}-${String(month).padStart(2, "0")}-01`;

/**
 * Everything the Budgets screen shows for one month.
 *
 * Spent comes from `month_summary`, the same RPC the Records strip and
 * Analysis use, so a category's number cannot disagree with itself across two
 * screens, which is the kind of difference nobody can explain afterwards.
 */
export async function getBudgetMonth({
  year,
  month,
  today,
  isCurrentMonth,
}: {
  year: number;
  month: number;
  /** Today where the user is, `yyyy-mm-dd`. */
  today: string;
  isCurrentMonth: boolean;
}): Promise<BudgetMonth> {
  const supabase = await createClient();
  const start = monthStart(year, month);

  const [budgets, summary] = await Promise.all([
    supabase
      .from("budgets")
      .select(
        "category_id, amount, category:categories(name, icon, tint, archived)",
      )
      .eq("month", start),
    supabase.rpc("month_summary", { p_month: start }).maybeSingle(),
  ]);

  if (budgets.error) throw new Error(budgets.error.message);
  if (summary.error) throw new Error(summary.error.message);

  const spentByCategory = new Map<string, bigint>();

  for (const row of (summary.data?.categories ?? []) as SummaryCategory[]) {
    spentByCategory.set(row.category_id, fromDb(row.total));
  }

  type BudgetRow = {
    category_id: string;
    amount: number;
    category: {
      name: string;
      icon: string | null;
      tint: string | null;
      archived: boolean;
    } | null;
  };

  let totalBudget = 0n;
  let totalSpent = 0n;

  const decorated = (budgets.data as unknown as BudgetRow[]).map((row) => {
    const amount = fromDb(row.amount);
    const spent = spentByCategory.get(row.category_id) ?? 0n;

    totalBudget += amount;
    totalSpent += spent;

    return {
      // Worked out once rather than inside the comparator, which would do it
      // O(n log n) times.
      ratio: amount > 0n ? Number((spent * 1000n) / amount) : 0,
      line: {
        categoryId: row.category_id,
        name: row.category?.name ?? "Category",
        icon: row.category?.icon ?? null,
        tint: (row.category?.tint as string | null) ?? null,
        budget: amount.toString(),
        spent: spent.toString(),
      },
    };
  });

  // Worst first: the one about to go over is the one worth reading.
  const lines: BudgetLine[] = decorated
    .sort((a, b) => b.ratio - a.ratio || a.line.name.localeCompare(b.line.name))
    .map((entry) => entry.line);

  return {
    lines,
    totalBudget: totalBudget.toString(),
    totalSpent: totalSpent.toString(),
    monthExpense: fromDb(summary.data?.total_expense ?? 0).toString(),
    daysLeft: isCurrentMonth
      ? daysInMonth(year, month) - Number(today.slice(8, 10)) + 1
      : 0,
    pace: isCurrentMonth
      ? (Number(today.slice(8, 10)) / daysInMonth(year, month)) * 100
      : start < today
        ? 100
        : null,
  };
}

/** The expense categories a budget may be set on. */
export async function getBudgetableCategories() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("categories")
    .select("id, name, icon, tint")
    .eq("kind", "expense")
    .eq("archived", false)
    .order("sort_order", { ascending: true });

  if (error) throw new Error(error.message);
  return data;
}

export type BudgetHint = {
  categoryId: string;
  /** Minor units as text. */
  lastMonth: string;
  threeMonthAverage: string;
};

/**
 * What this category has actually cost, for suggesting a limit.
 *
 * Last month and the three-month average, both straight from the rows. The
 * rounding to a number somebody would choose, ₹8,000 rather than ₹7,842,
 * happens at the edge, next to the currency's decimal places.
 */
export async function getBudgetHints(
  year: number,
  month: number,
): Promise<BudgetHint[]> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("budget_hints", {
    p_month: monthStart(year, month),
  });

  // Never fatal: the sheet still works, it just stops offering to help.
  if (error) {
    console.error("[budgets]", error.message);
    return [];
  }

  return (data ?? []).map((row) => ({
    categoryId: row.category_id,
    lastMonth: fromDb(row.last_month).toString(),
    threeMonthAverage: fromDb(row.three_month_average).toString(),
  }));
}
