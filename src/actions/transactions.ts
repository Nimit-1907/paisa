"use server";

import { revalidatePath } from "next/cache";

import { z } from "zod";

import {
  type ActionResult,
  fail,
  failFromDb,
  ok,
  parseInput,
} from "@/lib/action-result";
import { requireUser } from "@/lib/auth-guard";
import { instantToLocal, localToInstant, nextRecurrence } from "@/lib/dates";
import { evaluate } from "@/lib/calculator";
import { toDb } from "@/lib/money";
import { currencyOf, getProfile } from "@/lib/profile";
import {
  type TransactionPage,
  getMonthTransactions,
  searchTransactions,
} from "@/lib/queries/transactions";
import {
  type CreateTransactionInput,
  type RestoreTransactionInput,
  type UpdateTransactionInput,
  createTransactionSchema,
  restoreTransactionSchema,
  type TransactionFilters,
  transactionFiltersSchema,
  transactionIdSchema,
  updateTransactionSchema,
} from "@/lib/schemas/transactions";
import { createClient } from "@/lib/supabase/server";

const searchSchema = z.object({
  term: z.string().trim().min(1, "Type something to search for.").max(100),
});

const loadMoreSchema = z.object({
  year: z.number().int().min(1970).max(9999),
  month: z.number().int().min(1).max(12),
  offset: z.number().int().min(0).max(10_000),
  filters: transactionFiltersSchema.optional(),
});

/** Everything whose numbers move when a record does. */
function revalidateRecords() {
  revalidatePath("/records");
  revalidatePath("/analysis");
  revalidatePath("/budgets");
  revalidatePath("/accounts");
}

type Prepared = {
  amount: number;
  occurredAt: string;
  timeZone: string;
};

/**
 * Turns what the sheet collected into what the row needs.
 *
 * The amount arrives as whatever the keypad holds — "120+45" is as valid as
 * "165" — and the time arrives as the wall clock the user saw, which only
 * their timezone can place on the calendar.
 */
async function prepare(
  amountText: string,
  occurredAtLocal: string,
): Promise<
  { ok: true; value: Prepared } | { ok: false; error: string; field?: string }
> {
  const profile = await getProfile();
  const currency = currencyOf(profile);
  const timeZone = profile?.timezone ?? "Asia/Kolkata";

  const calculated = evaluate(amountText, currency.decimals);
  if (!calculated.ok) {
    return { ok: false, error: calculated.error, field: "amount" };
  }

  if (calculated.minor <= 0n) {
    return {
      ok: false,
      error: "An amount has to be more than zero.",
      field: "amount",
    };
  }

  const instant = localToInstant(occurredAtLocal, timeZone);
  if (!instant) {
    return { ok: false, error: "Pick a date and time.", field: "occurredAt" };
  }

  return {
    ok: true,
    value: {
      amount: toDb(calculated.minor),
      occurredAt: instant.toISOString(),
      timeZone,
    },
  };
}

export type SavedTransaction = {
  id: string;
  /** Present when a repeat was asked for: false means only the record saved. */
  repeatSaved?: boolean;
  /** Present when the edit was meant for the rule too. */
  ruleSaved?: boolean;
};

export async function createTransaction(
  input: CreateTransactionInput,
): Promise<ActionResult<SavedTransaction>> {
  const parsed = parseInput(createTransactionSchema, input);
  if (!parsed.ok) return parsed;

  const supabase = await createClient();
  const user = await requireUser(supabase);
  if (!user.ok) return user;

  const prepared = await prepare(parsed.data.amount, parsed.data.occurredAt);
  if (!prepared.ok) return fail(prepared.error, prepared.field);

  // The record is written first, and the rule after it. In the other order a
  // failed transaction leaves a rule nobody asked for, quietly creating
  // records later for something the user was told had not saved.
  const { data, error } = await supabase
    .from("transactions")
    .insert({
      user_id: user.id,
      type: parsed.data.type,
      amount: prepared.value.amount,
      account_id: parsed.data.accountId,
      to_account_id: parsed.data.toAccountId ?? null,
      category_id: parsed.data.categoryId ?? null,
      note: parsed.data.note ?? null,
      occurred_at: prepared.value.occurredAt,
    })
    .select("id")
    .single();

  if (error) return failFromDb(error, "Could not save the record.");

  let repeatSaved: boolean | undefined;

  if (parsed.data.repeat) {
    const repeat = parsed.data.repeat;
    const localDay = instantToLocal(
      prepared.value.occurredAt,
      prepared.value.timeZone,
    ).slice(0, 10);

    const { data: rule, error: ruleError } = await supabase
      .from("recurring_rules")
      .insert({
        user_id: user.id,
        type: parsed.data.type,
        amount: prepared.value.amount,
        account_id: parsed.data.accountId,
        to_account_id: parsed.data.toAccountId ?? null,
        category_id: parsed.data.categoryId ?? null,
        note: parsed.data.note ?? null,
        frequency: repeat.frequency,
        interval_count: Number(repeat.interval),
        start_date: localDay,
        end_date: repeat.endDate ?? null,
        // The occurrence after this one: the record being saved right now is
        // the first, and starting the rule today would have
        // process_due_recurring immediately duplicate it.
        next_run_on: nextRecurrence(
          localDay,
          repeat.frequency,
          Number(repeat.interval),
        ),
      })
      .select("id")
      .single();

    if (ruleError) {
      console.error("[records] repeat not created:", ruleError.message);
      repeatSaved = false;
    } else {
      repeatSaved = true;

      // Only the link is left; if this fails the rule still works, the row
      // just will not show its repeat marker.
      const { error: linkError } = await supabase
        .from("transactions")
        .update({ recurring_rule_id: rule.id })
        .eq("id", data.id);

      if (linkError) {
        console.error("[records] repeat not linked:", linkError.message);
      }
    }
  }

  revalidateRecords();
  return ok({ id: data.id, repeatSaved });
}

export async function updateTransaction(
  input: UpdateTransactionInput,
): Promise<ActionResult<SavedTransaction>> {
  const parsed = parseInput(updateTransactionSchema, input);
  if (!parsed.ok) return parsed;

  const supabase = await createClient();
  const user = await requireUser(supabase);
  if (!user.ok) return user;

  const prepared = await prepare(parsed.data.amount, parsed.data.occurredAt);
  if (!prepared.ok) return fail(prepared.error, prepared.field);

  const { data, error } = await supabase
    .from("transactions")
    .update({
      type: parsed.data.type,
      amount: prepared.value.amount,
      account_id: parsed.data.accountId,
      to_account_id: parsed.data.toAccountId ?? null,
      category_id: parsed.data.categoryId ?? null,
      note: parsed.data.note ?? null,
      occurred_at: prepared.value.occurredAt,
    })
    .eq("id", parsed.data.id)
    .eq("user_id", user.id)
    .select("id, recurring_rule_id")
    .maybeSingle();

  if (error) return failFromDb(error, "Could not save the record.");
  if (!data) return fail("That record no longer exists.");

  let ruleSaved: boolean | undefined;

  if (parsed.data.applyToRule && data.recurring_rule_id) {
    // The template only. Frequency, anchor and end date stay where the user
    // put them on the rule's own screen, and nothing already created moves —
    // that is what makes this "future occurrences only".
    const { error: ruleError } = await supabase
      .from("recurring_rules")
      .update({
        type: parsed.data.type,
        amount: prepared.value.amount,
        account_id: parsed.data.accountId,
        to_account_id: parsed.data.toAccountId ?? null,
        category_id: parsed.data.categoryId ?? null,
        note: parsed.data.note ?? null,
      })
      .eq("id", data.recurring_rule_id)
      .eq("user_id", user.id);

    ruleSaved = !ruleError;
    if (ruleError)
      console.error("[records] rule not updated:", ruleError.message);
    else revalidatePath("/recurring");
  }

  revalidateRecords();
  return ok({ id: data.id, ruleSaved });
}

export async function deleteTransaction(input: {
  id: string;
}): Promise<ActionResult<undefined>> {
  const parsed = parseInput(transactionIdSchema, input);
  if (!parsed.ok) return parsed;

  const supabase = await createClient();
  const user = await requireUser(supabase);
  if (!user.ok) return user;

  const { data, error } = await supabase
    .from("transactions")
    .delete()
    .eq("id", parsed.data.id)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();

  if (error) return failFromDb(error, "Could not delete the record.");
  if (!data) return fail("That record no longer exists.");

  revalidateRecords();
  return ok(undefined);
}

/**
 * Puts back a record the user has just deleted, id and all.
 *
 * Undo has to restore the same row rather than a copy: anything that
 * referenced it — a recurring rule, a link someone kept open — should still
 * point at the record they got back.
 */
export async function restoreTransaction(
  input: RestoreTransactionInput,
): Promise<ActionResult<SavedTransaction>> {
  const parsed = parseInput(restoreTransactionSchema, input);
  if (!parsed.ok) return parsed;

  const supabase = await createClient();
  const user = await requireUser(supabase);
  if (!user.ok) return user;

  const prepared = await prepare(parsed.data.amount, parsed.data.occurredAt);
  if (!prepared.ok) return fail(prepared.error, prepared.field);

  const { data, error } = await supabase
    .from("transactions")
    .insert({
      id: parsed.data.id,
      user_id: user.id,
      type: parsed.data.type,
      amount: prepared.value.amount,
      account_id: parsed.data.accountId,
      to_account_id: parsed.data.toAccountId ?? null,
      category_id: parsed.data.categoryId ?? null,
      note: parsed.data.note ?? null,
      occurred_at: prepared.value.occurredAt,
      recurring_rule_id: parsed.data.recurringRuleId ?? null,
    })
    .select("id")
    .single();

  if (error) return failFromDb(error, "Could not undo that.");

  revalidateRecords();
  return ok({ id: data.id });
}

/**
 * The next page of a month's records.
 *
 * A Server Action rather than a route handler: the client already has the
 * month and the filters, and this keeps one validated path to the query
 * instead of a second public URL that would need its own guard.
 */
export async function loadMoreTransactions(input: {
  year: number;
  month: number;
  offset: number;
  filters?: TransactionFilters;
}): Promise<ActionResult<TransactionPage>> {
  const parsed = parseInput(loadMoreSchema, input);
  if (!parsed.ok) return parsed;

  const supabase = await createClient();
  const user = await requireUser(supabase);
  if (!user.ok) return user;

  const profile = await getProfile();
  const currency = currencyOf(profile);

  try {
    const page = await getMonthTransactions({
      year: parsed.data.year,
      month: parsed.data.month,
      timeZone: profile?.timezone ?? "Asia/Kolkata",
      decimals: currency.decimals,
      filters: parsed.data.filters,
      offset: parsed.data.offset,
    });

    return ok(page);
  } catch (thrown) {
    console.error("[records]", thrown);
    return fail("Could not load more records.");
  }
}

/** What a search returns, with the amounts as strings for the client. */
export type SearchPayload = {
  rows: Awaited<ReturnType<typeof searchTransactions>>["rows"];
  /** How many match in all, which can be more than `rows.length`. */
  matchCount: number;
  hasMore: boolean;
  /** Minor units as text — a BigInt cannot cross this boundary. */
  income: string;
  expense: string;
};

/**
 * Search every month at once, for the full-screen search.
 *
 * A Server Action rather than a route handler: the search overlay is the
 * only caller, and a second public URL would need its own guard for no gain.
 */
export async function searchRecords(input: {
  term: string;
}): Promise<ActionResult<SearchPayload>> {
  const parsed = parseInput(searchSchema, input);
  if (!parsed.ok) return parsed;

  const supabase = await createClient();
  const user = await requireUser(supabase);
  if (!user.ok) return user;

  try {
    const result = await searchTransactions(parsed.data.term);

    return ok({
      rows: result.rows,
      matchCount: result.matchCount,
      hasMore: result.hasMore,
      income: result.income.toString(),
      expense: result.expense.toString(),
    });
  } catch (thrown) {
    console.error("[records]", thrown);
    return fail("Could not search your records. Check your connection.");
  }
}
