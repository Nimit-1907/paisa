import "server-only";

import { fromDb } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type CategoryRow = Database["public"]["Tables"]["categories"]["Row"];

export type CategoryWithUsage = CategoryRow & {
  /** Transactions, budgets and rules pointing at this category. */
  usageCount: number;
  transactionCount: number;
};

/** Every category of the caller, with what depends on it. */
export async function getCategoriesOverview(): Promise<CategoryWithUsage[]> {
  const supabase = await createClient();

  const [categories, usage] = await Promise.all([
    supabase
      .from("categories")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase
      .from("category_usage")
      .select(
        "category_id, transaction_count, budget_count, recurring_rule_count",
      ),
  ]);

  if (categories.error) throw new Error(categories.error.message);
  if (usage.error) throw new Error(usage.error.message);

  const usageById = new Map(usage.data.map((row) => [row.category_id, row]));

  return categories.data.map((category) => {
    const counts = usageById.get(category.id);
    const transactionCount = counts?.transaction_count ?? 0;

    return {
      ...category,
      transactionCount,
      usageCount:
        transactionCount +
        (counts?.budget_count ?? 0) +
        (counts?.recurring_rule_count ?? 0),
    };
  });
}

/**
 * The categories a picker may offer.
 *
 * Archived ones are left out on purpose: they stay readable on the records
 * that already use them, but must not be chosen again.
 */
export async function getActiveCategories(
  kind?: Database["public"]["Enums"]["category_kind"],
) {
  const supabase = await createClient();

  let query = supabase
    .from("categories")
    .select("*")
    .eq("archived", false)
    .order("sort_order", { ascending: true });

  if (kind) query = query.eq("kind", kind);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data;
}

/**
 * What each category has come to this month, keyed by id.
 *
 * Both kinds in one map: the Categories screen shows expense and income
 * under the same toggle, and two round trips to colour one grid is a round
 * trip too many. The amounts are minor units as text, because this crosses
 * the RSC boundary.
 *
 * `null` when either half fails, not an empty map. An empty map would make
 * every category read ₹0, which is a claim ("you spent nothing on Food")
 * rather than an absence. The screen drops the line entirely instead, and
 * goes back to being a grid of names, which is what it was before.
 */
export async function getCategoryMonthTotals(
  monthStart: string,
): Promise<Map<string, string> | null> {
  const supabase = await createClient();
  const monthEnd = lastDayOfMonth(monthStart);

  const [expense, income] = await Promise.all([
    supabase.rpc("category_totals", {
      p_from: monthStart,
      p_to: monthEnd,
      p_kind: "expense",
    }),
    supabase.rpc("category_totals", {
      p_from: monthStart,
      p_to: monthEnd,
      p_kind: "income",
    }),
  ]);

  const totals = new Map<string, string>();

  for (const result of [expense, income]) {
    if (result.error) {
      console.error("[categories]", result.error.message);
      return null;
    }

    for (const row of result.data ?? []) {
      totals.set(row.category_id, fromDb(row.total).toString());
    }
  }

  return totals;
}

/** The last day of the month a `yyyy-mm-01` starts. */
function lastDayOfMonth(monthStart: string): string {
  const [year = 1970, month = 1] = monthStart.split("-").map(Number);
  const last = new Date(Date.UTC(year, month, 0));
  return last.toISOString().slice(0, 10);
}
