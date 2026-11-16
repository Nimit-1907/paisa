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
import { evaluate } from "@/lib/calculator";
import { toDb } from "@/lib/money";
import { DEFAULT_TIME_ZONE } from "@/lib/month-param";
import { currencyOf, getProfile } from "@/lib/profile";
import { localToday } from "@/lib/recurring-check";
import {
  type CreateRecurringRuleInput,
  type UpdateRecurringRuleInput,
  createRecurringRuleSchema,
  deleteRecurringRuleSchema,
  pauseRecurringRuleSchema,
  payOccurrenceSchema,
  skipOccurrenceSchema,
  updateRecurringRuleSchema,
} from "@/lib/schemas/recurring";
import { createClient } from "@/lib/supabase/server";

/** Everything a rule can move: its own screens, and the records it creates. */
function revalidateRecurring(id?: string) {
  revalidatePath("/recurring");
  revalidatePath("/records");
  revalidatePath("/accounts");
  revalidatePath("/analysis");
  revalidatePath("/budgets");
  if (id) revalidatePath(`/recurring/${id}`);
}

/**
 * Creates a rule. The only way a rule is made: records never make one.
 *
 * The first occurrence is `nextRunOn`. When that is today or already past,
 * the generator runs straight away so the expense is taken from its account
 * now, as it would be on its due date, instead of waiting for tomorrow's
 * daily catch-up. The generator advances the rule's cursor in the same
 * statement that writes each record, which is what keeps a second run (or
 * the daily one) from taking it twice.
 */
export async function createRecurringRule(
  input: CreateRecurringRuleInput,
): Promise<ActionResult<{ id: string; created: number }>> {
  const parsed = parseInput(createRecurringRuleSchema, input);
  if (!parsed.ok) return parsed;

  const profile = await getProfile();
  const currency = currencyOf(profile);
  const calculated = evaluate(parsed.data.amount, currency.decimals);
  if (!calculated.ok) return fail(calculated.error, "amount");
  if (calculated.minor <= 0n) {
    return fail("An amount has to be more than zero.", "amount");
  }

  if (parsed.data.endDate && parsed.data.endDate < parsed.data.nextRunOn) {
    return fail("The end date is before the first one.", "endDate");
  }

  const supabase = await createClient();
  const user = await requireUser(supabase);
  if (!user.ok) return user;

  const { data, error } = await supabase
    .from("recurring_rules")
    .insert({
      user_id: user.id,
      type: parsed.data.type,
      amount: toDb(calculated.minor),
      account_id: parsed.data.accountId,
      to_account_id: parsed.data.toAccountId ?? null,
      category_id: parsed.data.categoryId ?? null,
      note: parsed.data.note ?? null,
      frequency: parsed.data.frequency,
      interval_count: parsed.data.interval,
      start_date: parsed.data.nextRunOn,
      next_run_on: parsed.data.nextRunOn,
      end_date: parsed.data.endDate ?? null,
    })
    .select("id")
    .single();

  if (error) {
    // 42501: check_entry_refs() refusing an account or category that is not
    // the caller's. See updateRecurringRule.
    if (error.code === "42501") {
      return fail("That account or category is not available any more.");
    }
    return failFromDb(error, "Could not save the rule.");
  }

  let created = 0;
  const today = localToday(profile?.timezone ?? DEFAULT_TIME_ZONE);

  if (parsed.data.nextRunOn <= today) {
    const { data: count, error: runError } = await supabase.rpc(
      "process_due_recurring",
    );
    // Not a failure of the save: the rule exists, and the daily catch-up
    // will post what is due if this did not.
    if (runError) console.error("[recurring]", runError.message);
    else created = Number(count ?? 0);
  }

  revalidateRecurring(data.id);
  return ok({ id: data.id, created });
}

/**
 * Saves a rule.
 *
 * Only the template and the schedule change: the transactions it has already
 * created are left exactly as they are, which is what "applies to future
 * occurrences" means. `next_run_on` is also written to `start_date`, so the
 * schedule is re-anchored from the date the user chose rather than from
 * wherever the rule originally began.
 */
export async function updateRecurringRule(
  input: UpdateRecurringRuleInput,
): Promise<ActionResult<{ id: string }>> {
  const parsed = parseInput(updateRecurringRuleSchema, input);
  if (!parsed.ok) return parsed;

  const currency = currencyOf(await getProfile());
  const calculated = evaluate(parsed.data.amount, currency.decimals);
  if (!calculated.ok) return fail(calculated.error, "amount");
  if (calculated.minor <= 0n) {
    return fail("An amount has to be more than zero.", "amount");
  }

  if (parsed.data.endDate && parsed.data.endDate < parsed.data.nextRunOn) {
    return fail("The end date is before the next run.", "endDate");
  }

  const supabase = await createClient();
  const user = await requireUser(supabase);
  if (!user.ok) return user;

  const { data, error } = await supabase
    .from("recurring_rules")
    .update({
      type: parsed.data.type,
      amount: toDb(calculated.minor),
      account_id: parsed.data.accountId,
      to_account_id: parsed.data.toAccountId ?? null,
      category_id: parsed.data.categoryId ?? null,
      note: parsed.data.note ?? null,
      frequency: parsed.data.frequency,
      interval_count: parsed.data.interval,
      start_date: parsed.data.nextRunOn,
      next_run_on: parsed.data.nextRunOn,
      end_date: parsed.data.endDate ?? null,
      // Left to the trigger, which reads it off the new start date: the form
      // offers one date, and two ways of saying which day of the month a rule
      // lands on would only ever disagree.
      anchor_day: null,
    })
    .eq("id", parsed.data.id)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();

  if (error) {
    // 42501 is check_entry_refs() refusing an account or category that is not
    // the caller's. RLS cannot catch that one, it governs which rows you may
    // touch, not which ids you may write into a column, so the trigger does,
    // and this turns it into a sentence.
    if (error.code === "42501") {
      return fail("That account or category is not available any more.");
    }
    return failFromDb(error, "Could not save the rule.");
  }

  if (!data) return fail("That recurring rule no longer exists.");

  revalidateRecurring(parsed.data.id);
  return ok({ id: data.id });
}

export async function setRecurringRulePaused(
  input: { id: string; paused: boolean },
): Promise<ActionResult<{ paused: boolean }>> {
  const parsed = parseInput(pauseRecurringRuleSchema, input);
  if (!parsed.ok) return parsed;

  const supabase = await createClient();
  const user = await requireUser(supabase);
  if (!user.ok) return user;

  const { data, error } = await supabase
    .from("recurring_rules")
    .update({ active: !parsed.data.paused })
    .eq("id", parsed.data.id)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();

  if (error) {
    return failFromDb(
      error,
      parsed.data.paused
        ? "Could not pause the rule."
        : "Could not resume the rule.",
    );
  }

  if (!data) return fail("That recurring rule no longer exists.");

  revalidateRecurring(parsed.data.id);
  return ok({ paused: parsed.data.paused });
}

/**
 * Skips one occurrence.
 *
 * Recorded on the rule rather than nudging `next_run_on`, so a catch-up
 * months later still passes over it instead of deciding it was simply missed.
 */
export async function skipNextOccurrence(
  input: { id: string; on: string },
): Promise<ActionResult<{ nextRunOn: string }>> {
  const parsed = parseInput(skipOccurrenceSchema, input);
  if (!parsed.ok) return parsed;

  const supabase = await createClient();
  const user = await requireUser(supabase);
  if (!user.ok) return user;

  const { data, error } = await supabase.rpc("skip_recurring_occurrence", {
    p_rule_id: parsed.data.id,
    p_on: parsed.data.on,
  });

  if (error) {
    // 22023 is the RPC's own "that is not an occurrence of this rule", which
    // means the list the button came from is out of date.
    if (error.code === "22023") {
      return fail("That occurrence has already moved. Refresh and try again.");
    }
    if (error.code === "P0002") {
      return fail("That recurring rule no longer exists.");
    }
    return failFromDb(error, "Could not skip that one.");
  }

  revalidateRecurring(parsed.data.id);
  return ok({ nextRunOn: data as unknown as string });
}

/**
 * Pays an upcoming occurrence now.
 *
 * The record keeps the occurrence's own date rather than today's: it is the
 * 1 December rent paid on 28 November, and dating it today would file it in
 * the wrong month and leave the occurrence free to be created again.
 */
export async function payOccurrenceNow(
  input: { id: string; on: string },
): Promise<ActionResult<{ transactionId: string | null }>> {
  const parsed = parseInput(payOccurrenceSchema, input);
  if (!parsed.ok) return parsed;

  const supabase = await createClient();
  const user = await requireUser(supabase);
  if (!user.ok) return user;

  const { data, error } = await supabase.rpc("materialise_recurring", {
    p_rule_id: parsed.data.id,
    p_on: parsed.data.on,
  });

  if (error) {
    if (error.code === "22023") {
      return fail("That occurrence has already moved. Refresh and try again.");
    }
    if (error.code === "P0002") {
      return fail("That recurring rule no longer exists.");
    }
    return failFromDb(error, "Could not add that record.");
  }

  revalidateRecurring(parsed.data.id);

  // Null means the row was already there, the rule has simply caught up.
  return ok({ transactionId: (data as unknown as string | null) ?? null });
}

export async function deleteRecurringRule(
  input: { id: string; deleteTransactions?: boolean },
): Promise<ActionResult<{ deletedTransactions: number }>> {
  const parsed = parseInput(deleteRecurringRuleSchema, input);
  if (!parsed.ok) return parsed;

  const supabase = await createClient();
  const user = await requireUser(supabase);
  if (!user.ok) return user;

  const { data, error } = await supabase.rpc("delete_recurring_rule", {
    p_rule_id: parsed.data.id,
    p_delete_transactions: parsed.data.deleteTransactions,
  });

  if (error) {
    if (error.code === "P0002") {
      return fail("That recurring rule no longer exists.");
    }
    return failFromDb(error, "Could not delete the rule.");
  }

  revalidateRecurring();
  return ok({ deletedTransactions: Number(data ?? 0) });
}

/**
 * Runs the generator on demand.
 *
 * The app layout does this once a day by itself; this is the button for
 * someone who has just fixed a rule and wants to see it catch up now.
 */
export async function runRecurringNow(): Promise<
  ActionResult<{ created: number }>
> {
  const supabase = await createClient();
  const user = await requireUser(supabase);
  if (!user.ok) return user;

  const { data, error } = await supabase.rpc("process_due_recurring");

  if (error) return failFromDb(error, "Could not run the recurring records.");

  // Marked done either way: the point of the stamp is "today has been
  // handled", not "today produced something".
  const profile = await getProfile();
  const { error: stampError } = await supabase
    .from("profiles")
    .update({
      last_recurring_check: localToday(profile?.timezone ?? DEFAULT_TIME_ZONE),
    })
    .eq("id", user.id);

  // Logged, not returned: the records were created, and the worst a missing
  // stamp costs is the next page load running an idempotent generator again.
  if (stampError) console.error("[recurring]", stampError.message);

  revalidateRecurring();
  return ok({ created: Number(data ?? 0) });
}
