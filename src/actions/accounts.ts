"use server";

import { revalidatePath } from "next/cache";

import {
  type ActionResult,
  fail,
  failFromDb,
  ok,
  parseInput,
} from "@/lib/action-result";
import { toDb, tryToMinor } from "@/lib/money";
import { currencyOf, getProfile } from "@/lib/profile";
import {
  type AccountFormInput,
  type UpdateAccountInput,
  accountIdSchema,
  archiveAccountSchema,
  createAccountSchema,
  reorderSchema,
  updateAccountSchema,
} from "@/lib/schemas/accounts";
import { createClient } from "@/lib/supabase/server";

/**
 * The signed-in user, or the failure to return.
 *
 * RLS is the real guard — rls.test.sql proves a user cannot touch another's
 * rows — but filtering on user_id as well makes "no row matched" mean what it
 * says, and gives an expired session a message of its own.
 */
async function requireUser(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<
  { ok: true; id: string } | { ok: false; error: string; field?: string }
> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      error: "Your session has expired. Sign in and try again.",
    };
  }

  return { ok: true, id: user.id };
}

/** Every screen that can show an account or a balance. */
function revalidateAccounts(id?: string) {
  revalidatePath("/accounts");
  revalidatePath("/records");
  revalidatePath("/analysis");
  if (id) revalidatePath(`/accounts/${id}`);
}

/**
 * Parses an opening balance using the user's own decimal places.
 *
 * ₹12.50 is 1250 paise but KD 12.50 is 12500 fils, so the exponent has to
 * come from the profile rather than a constant.
 */
async function parseBalance(
  input: string,
): Promise<{ ok: true; minor: bigint } | { ok: false; error: string }> {
  const currency = currencyOf(await getProfile());
  const trimmed = input.trim();

  if (!trimmed) return { ok: true, minor: 0n };

  const minor = tryToMinor(trimmed, currency.decimals);
  if (minor === null) {
    return { ok: false, error: "That opening balance is not a number." };
  }

  return { ok: true, minor };
}

export async function createAccount(
  input: AccountFormInput,
): Promise<ActionResult<{ id: string }>> {
  const parsed = parseInput(createAccountSchema, input);
  if (!parsed.ok) return parsed;

  const balance = await parseBalance(parsed.data.initialBalance);
  if (!balance.ok) return fail(balance.error, "initialBalance");

  const supabase = await createClient();

  const user = await requireUser(supabase);
  if (!user.ok) return user;

  // New accounts go to the end of the list.
  const { data: last } = await supabase
    .from("accounts")
    .select("sort_order")
    .eq("user_id", user.id)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabase
    .from("accounts")
    .insert({
      user_id: user.id,
      name: parsed.data.name,
      type: parsed.data.type,
      icon: parsed.data.icon,
      color: parsed.data.color,
      initial_balance: toDb(balance.minor),
      include_in_total: parsed.data.includeInTotal,
      sort_order: (last?.sort_order ?? -1) + 1,
    })
    .select("id")
    .single();

  if (error) return failFromDb(error, "Could not add the account.");

  revalidateAccounts();
  return ok({ id: data.id });
}

export async function updateAccount(
  input: UpdateAccountInput,
): Promise<ActionResult<{ id: string }>> {
  const parsed = parseInput(updateAccountSchema, input);
  if (!parsed.ok) return parsed;

  const balance = await parseBalance(parsed.data.initialBalance);
  if (!balance.ok) return fail(balance.error, "initialBalance");

  const supabase = await createClient();

  const user = await requireUser(supabase);
  if (!user.ok) return user;

  const { data, error } = await supabase
    .from("accounts")
    .update({
      name: parsed.data.name,
      type: parsed.data.type,
      icon: parsed.data.icon,
      color: parsed.data.color,
      initial_balance: toDb(balance.minor),
      include_in_total: parsed.data.includeInTotal,
    })
    .eq("id", parsed.data.id)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();

  if (error) return failFromDb(error, "Could not save the account.");

  // RLS makes a row that is not the caller's invisible rather than
  // forbidden, so "no error" is not the same as "something changed".
  if (!data) return fail("That account no longer exists.");

  revalidateAccounts(parsed.data.id);
  return ok({ id: parsed.data.id });
}

export async function setAccountArchived(
  input: { id: string; archived: boolean },
): Promise<ActionResult<{ archived: boolean }>> {
  const parsed = parseInput(archiveAccountSchema, input);
  if (!parsed.ok) return parsed;

  const supabase = await createClient();

  const user = await requireUser(supabase);
  if (!user.ok) return user;

  const { data, error } = await supabase
    .from("accounts")
    .update({ archived: parsed.data.archived })
    .eq("id", parsed.data.id)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();

  if (error) {
    return failFromDb(
      error,
      parsed.data.archived
        ? "Could not archive the account."
        : "Could not restore the account.",
    );
  }

  if (!data) return fail("That account no longer exists.");

  revalidateAccounts(parsed.data.id);
  return ok({ archived: parsed.data.archived });
}

export async function deleteAccount(
  input: { id: string },
): Promise<ActionResult<undefined>> {
  const parsed = parseInput(accountIdSchema, input);
  if (!parsed.ok) return parsed;

  const supabase = await createClient();

  const user = await requireUser(supabase);
  if (!user.ok) return user;

  // The UI only offers delete for an unused account, but the check has to
  // live here too: the page data could be minutes old, and the foreign keys
  // would otherwise fail at commit with a message no user should read.
  const { data: usage, error: usageError } = await supabase
    .from("account_usage")
    .select("transaction_count, recurring_rule_count")
    .eq("account_id", parsed.data.id)
    .maybeSingle();

  if (usageError) {
    return failFromDb(usageError, "Could not check the account.");
  }

  const inUse =
    (usage?.transaction_count ?? 0) > 0 ||
    (usage?.recurring_rule_count ?? 0) > 0;

  if (inUse) {
    return fail(
      "This account still has records. Archive it instead to keep them.",
    );
  }

  const { data: deleted, error } = await supabase
    .from("accounts")
    .delete()
    .eq("id", parsed.data.id)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();

  if (error) {
    // A record could have been added between the check above and this
    // delete; the foreign key catches it, and the user gets the same advice
    // they would have had a moment earlier.
    if (error.code === "23503") {
      return fail(
        "This account still has records. Archive it instead to keep them.",
      );
    }
    return failFromDb(error, "Could not delete the account.");
  }

  if (!deleted) return fail("That account no longer exists.");

  revalidateAccounts();
  return ok(undefined);
}

/**
 * Writes a new order for the whole list.
 *
 * The client sends the ids in their new order; position in that array is the
 * sort_order. Sending the full list rather than a moved pair means a reorder
 * can never leave two accounts fighting over the same slot.
 */
export async function reorderAccounts(
  input: { ids: string[] },
): Promise<ActionResult<undefined>> {
  const parsed = parseInput(reorderSchema, input);
  if (!parsed.ok) return parsed;

  const supabase = await createClient();

  // One statement in one transaction: an update per id costs a round trip
  // each and can leave the order half-applied when one of them fails. Ids
  // that are not the caller's match nothing, so the RPC needs no extra guard.
  const { error } = await supabase.rpc("reorder_accounts", {
    p_ids: parsed.data.ids,
  });

  if (error) return failFromDb(error, "Could not save the new order.");

  revalidateAccounts();
  return ok(undefined);
}
