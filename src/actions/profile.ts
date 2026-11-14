"use server";

import { revalidatePath } from "next/cache";

import { type ActionResult, fail, ok, parseInput } from "@/lib/action-result";
import { findCurrency } from "@/lib/currencies";
import { toDb, tryToMinor } from "@/lib/money";
import { HOME_PATH } from "@/lib/routes";
import { type OnboardingInput, onboardingSchema } from "@/lib/schemas/profile";
import { createClient } from "@/lib/supabase/server";

/**
 * Finishes first-run setup: the user's name, their currency, and the opening
 * balance of the Cash account the signup trigger already created.
 *
 * Writing display_name is what marks onboarding as done — the (app) layout
 * sends anyone without one back here.
 */
export async function completeOnboarding(
  input: OnboardingInput,
): Promise<ActionResult<{ next: string }>> {
  const parsed = parseInput(onboardingSchema, input);
  if (!parsed.ok) return parsed;

  const { displayName, currencyCode, accountName, openingBalance } =
    parsed.data;

  const currency = findCurrency(currencyCode);
  if (!currency) {
    return fail("Pick a currency.", "currencyCode");
  }

  // An empty box means zero; anything else has to be a real amount.
  const minor = openingBalance
    ? tryToMinor(openingBalance, currency.decimals)
    : 0n;

  if (minor === null) {
    return fail("That opening balance is not a number.", "openingBalance");
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return fail("Your session has expired. Sign in and try again.");
  }

  // The account is written first and display_name last, because writing
  // display_name is what marks onboarding as finished. If the account write
  // failed after that flag was set, the user would be bounced into an app
  // configured by defaults with no way back to this screen.
  const { data: account, error: accountError } = await supabase
    .from("accounts")
    .select("id")
    .eq("user_id", user.id)
    .order("sort_order", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (accountError) {
    return fail(accountError.message);
  }

  if (account) {
    const { error } = await supabase
      .from("accounts")
      .update({ name: accountName, initial_balance: toDb(minor) })
      .eq("id", account.id);

    if (error) return fail(error.message);
  } else {
    // Belt and braces: the signup trigger always makes one, but a user who
    // deleted it should still get through setup.
    const { error } = await supabase.from("accounts").insert({
      user_id: user.id,
      name: accountName,
      type: "cash",
      icon: "Wallet",
      color: "#0F766E",
      initial_balance: toDb(minor),
      sort_order: 0,
    });

    if (error) return fail(error.message);
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      display_name: displayName,
      currency_code: currency.code,
      currency_symbol: currency.symbol,
      decimal_places: currency.decimals,
    })
    .eq("id", user.id);

  if (profileError) {
    return fail(profileError.message);
  }

  revalidatePath("/", "layout");
  return ok({ next: HOME_PATH });
}
