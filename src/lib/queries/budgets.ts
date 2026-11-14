import "server-only";

import { fromDb } from "@/lib/money";
import { getCreatedOccurrences, getRecurringRules } from "@/lib/queries/recurring";
import { daysInMonth } from "@/lib/recurrence";
import { upcomingBetween } from "@/lib/recurring-rule";
import { createClient } from "@/lib/supabase/server";

export type BudgetLine = {
  categoryId: string;
  name: string;
  icon: string | null;
  color: string | null;
  /** Minor units as text — an RSC payload cannot carry a BigInt. */
  budget: string;
  spent: string;
  /**
   * Recurring expenses for this category still to come this month. Zero
   * unless the month on screen is the one the user is living in.
   */
  scheduled: string;
};

export type UnbudgetedLine = {
  categoryId: string;
  name: string;
  icon: string | null;
  color: string | null;
  spent: string;
};

export type BudgetMonth = {
  lines: BudgetLine[];
  unbudgeted: UnbudgetedLine[];
  totalBudget: string;
  /** Spent in budgeted categories only — the number the top card compares. */
  totalSpent: string;
  /** Spent across every expense category, budgeted or not. */
  monthExpense: string;
  /** How many budgets last month had, for the "copy" button. */
  previousCount: number;
  /** Days remaining in the month, today included. Zero outside this month. */
  daysLeft: number;
};

type SummaryCategory = {
  category_id: string;
  name: string;
  icon: string | null;
  color: string | null;
  total: number | string;
};

const monthStart = (year: number, month: number) =>
  `${year}-${String(month).padStart(2, "0")}-01`;

/**
 * Everything the Budgets screen shows for one month.
 *
 * Spent comes from `month_summary`, the same RPC the Records strip and
 * Analysis use, so a category's number cannot disagree with itself across two
 * screens — which is the kind of difference nobody can explain afterwards.
 */
export async function getBudgetMonth({
  year,
  month,
  timeZone,
  today,
  isCurrentMonth,
}: {
  year: number;
  month: number;
  timeZone: string;
  /** Today where the user is, `yyyy-mm-dd`. */
  today: string;
  isCurrentMonth: boolean;
}): Promise<BudgetMonth> {
  const supabase = await createClient();
  const start = monthStart(year, month);
  const previousStart = monthStart(
    month === 1 ? year - 1 : year,
    month === 1 ? 12 : month - 1,
  );

  const [budgets, summary, previous] = await Promise.all([
    supabase
      .from("budgets")
      .select("category_id, amount, category:categories(name, icon, color, archived)")
      .eq("month", start),
    supabase.rpc("month_summary", { p_month: start }).maybeSingle(),
    supabase
      .from("budgets")
      .select("id", { count: "exact", head: true })
      .eq("month", previousStart),
  ]);

  if (budgets.error) throw new Error(budgets.error.message);
  if (summary.error) throw new Error(summary.error.message);
  if (previous.error) throw new Error(previous.error.message);

  const spentByCategory = new Map<string, bigint>();
  const categoryMeta = new Map<string, SummaryCategory>();

  for (const row of (summary.data?.categories ?? []) as SummaryCategory[]) {
    spentByCategory.set(row.category_id, fromDb(row.total));
    categoryMeta.set(row.category_id, row);
  }

  const scheduled = isCurrentMonth
    ? await getScheduledByCategory(year, month, timeZone, today)
    : new Map<string, bigint>();

  type BudgetRow = {
    category_id: string;
    amount: number;
    category: {
      name: string;
      icon: string | null;
      color: string | null;
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
        color: row.category?.color ?? null,
        budget: amount.toString(),
        spent: spent.toString(),
        scheduled: (scheduled.get(row.category_id) ?? 0n).toString(),
      },
    };
  });

  // Worst first: the one about to go over is the one worth reading.
  const lines: BudgetLine[] = decorated
    .sort((a, b) => b.ratio - a.ratio || a.line.name.localeCompare(b.line.name))
    .map((entry) => entry.line);

  const budgeted = new Set(lines.map((line) => line.categoryId));

  const unbudgeted: UnbudgetedLine[] = [...categoryMeta.values()]
    .filter((row) => !budgeted.has(row.category_id))
    .map((row) => ({
      categoryId: row.category_id,
      name: row.name,
      icon: row.icon,
      color: row.color,
      spent: fromDb(row.total).toString(),
    }))
    .sort((a, b) => {
      const left = BigInt(a.spent);
      const right = BigInt(b.spent);
      if (left === right) return a.name.localeCompare(b.name);
      return right > left ? 1 : -1;
    });

  return {
    lines,
    unbudgeted,
    totalBudget: totalBudget.toString(),
    totalSpent: totalSpent.toString(),
    monthExpense: fromDb(summary.data?.total_expense ?? 0).toString(),
    previousCount: previous.count ?? 0,
    daysLeft: isCurrentMonth
      ? daysInMonth(year, month) - Number(today.slice(8, 10)) + 1
      : 0,
  };
}

/**
 * Recurring expenses still to come this month, per category.
 *
 * Counted from today rather than from the start of the month: what has
 * already been created is in `spent` and counting it again would double it.
 */
async function getScheduledByCategory(
  year: number,
  month: number,
  timeZone: string,
  today: string,
): Promise<Map<string, bigint>> {
  const lastDay = `${year}-${String(month).padStart(2, "0")}-${String(
    daysInMonth(year, month),
  ).padStart(2, "0")}`;

  // Nothing left in the month: skip the queries entirely.
  if (today > lastDay) return new Map();

  const rules = await getRecurringRules();
  const active = rules.filter(
    (rule) => rule.active && rule.type === "expense" && rule.categoryId,
  );

  if (active.length === 0) return new Map();

  const created = await getCreatedOccurrences(
    active.map((rule) => rule.id),
    today,
    lastDay,
    timeZone,
  );

  const totals = new Map<string, bigint>();

  for (const item of upcomingBetween(active, today, lastDay, created)) {
    const categoryId = item.rule.categoryId;
    if (!categoryId) continue;

    totals.set(
      categoryId,
      (totals.get(categoryId) ?? 0n) + BigInt(item.rule.amount),
    );
  }

  return totals;
}

/** The expense categories a budget may be set on. */
export async function getBudgetableCategories() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("categories")
    .select("id, name, icon, color")
    .eq("kind", "expense")
    .eq("archived", false)
    .order("sort_order", { ascending: true });

  if (error) throw new Error(error.message);
  return data;
}
