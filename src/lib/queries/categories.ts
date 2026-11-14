import "server-only";

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
