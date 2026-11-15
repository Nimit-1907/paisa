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
import { localToInstant } from "@/lib/dates";
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

  // One record, never a rule: repeating records are created and managed on
  // the Recurring screen, and nowhere else.
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

  revalidateRecords();
  return ok({ id: data.id });
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
    .select("id")
    .maybeSingle();

  if (error) return failFromDb(error, "Could not save the record.");
  if (!data) return fail("That record no longer exists.");

  revalidateRecords();
  return ok({ id: data.id });
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
