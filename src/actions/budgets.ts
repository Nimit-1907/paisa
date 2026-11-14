"use server";

import { revalidatePath } from "next/cache";

import {
  type ActionResult,
  fail,
  failFromDb,
  ok,
  parseInput,
} from "@/lib/action-result";
import { requireUser } from "@/lib/auth-guard";
import { toDb, tryToMinor } from "@/lib/money";
import { currencyOf, getProfile } from "@/lib/profile";
import {
  APPLY_FORWARD_MONTHS,
  copyBudgetsSchema,
  deleteBudgetSchema,
  monthStartOf,
  type SetBudgetInput,
  setBudgetSchema,
} from "@/lib/schemas/budgets";
import { createClient } from "@/lib/supabase/server";

/** Budgets move the Budgets screen, and nothing else reads them. */
function revalidateBudgets() {
  revalidatePath("/budgets");
  revalidatePath("/analysis");
}

/**
 * Sets one category's budget for a month.
 *
 * `applyForward` carries the amount into the months after this one, stopping
 * at the first month that was set to something else — the database does that
 * walk in one statement, because a run of months half-written is worse than
 * one not written at all.
 */
export async function setBudget(
  input: SetBudgetInput,
): Promise<ActionResult<{ monthsWritten: number }>> {
  const parsed = parseInput(setBudgetSchema, input);
  if (!parsed.ok) return parsed;

  const start = monthStartOf(parsed.data.month);
  const currency = currencyOf(await getProfile());
  const minor = tryToMinor(parsed.data.amount, currency.decimals);

  if (minor === null) return fail("That is not an amount.", "amount");
  if (minor <= 0n) {
    return fail("A budget has to be more than zero.", "amount");
  }

  const supabase = await createClient();
  const user = await requireUser(supabase);
  if (!user.ok) return user;

  const { data, error } = await supabase.rpc("set_budget", {
    p_category_id: parsed.data.categoryId,
    p_month: start,
    p_amount: toDb(minor),
    p_apply_forward: parsed.data.applyForward,
    p_horizon: APPLY_FORWARD_MONTHS,
  });

  if (error) {
    // 23514 is the budgets trigger refusing an income category, 42501 a
    // category that is not the caller's.
    if (error.code === "23514") {
      return fail("Budgets are for expense categories only.", "categoryId");
    }
    if (error.code === "42501") {
      return fail("That category is not available any more.", "categoryId");
    }
    if (error.code === "22023") {
      return fail("A budget has to be more than zero.", "amount");
    }
    return failFromDb(error, "Could not save the budget.");
  }

  revalidateBudgets();
  return ok({ monthsWritten: Number(data ?? 1) });
}

export async function deleteBudget(
  input: { categoryId: string; month: string },
): Promise<ActionResult<undefined>> {
  const parsed = parseInput(deleteBudgetSchema, input);
  if (!parsed.ok) return parsed;

  const start = monthStartOf(parsed.data.month);
  const supabase = await createClient();
  const user = await requireUser(supabase);
  if (!user.ok) return user;

  const { data, error } = await supabase
    .from("budgets")
    .delete()
    .eq("category_id", parsed.data.categoryId)
    .eq("month", start)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();

  if (error) return failFromDb(error, "Could not remove the budget.");
  if (!data) return fail("That budget is already gone.");

  revalidateBudgets();
  return ok(undefined);
}

/**
 * Starts a month from the one before it.
 *
 * Only categories with no budget this month are copied, so pressing it twice
 * changes nothing the second time, and an archived category is left behind
 * rather than given a limit nobody can spend against.
 */
export async function copyPreviousMonthBudgets(
  input: { month: string },
): Promise<ActionResult<{ copied: number }>> {
  const parsed = parseInput(copyBudgetsSchema, input);
  if (!parsed.ok) return parsed;

  const start = monthStartOf(parsed.data.month);
  const supabase = await createClient();
  const user = await requireUser(supabase);
  if (!user.ok) return user;

  const { data, error } = await supabase.rpc(
    "copy_budgets_from_previous_month",
    { p_month: start },
  );

  if (error) return failFromDb(error, "Could not copy last month's budgets.");

  revalidateBudgets();
  return ok({ copied: Number(data ?? 0) });
}
