"use server";

import { revalidatePath } from "next/cache";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import {
  type ActionResult,
  fail,
  failFromDb,
  ok,
  parseInput,
} from "@/lib/action-result";
import { requireUser } from "@/lib/auth-guard";
import { findCurrency } from "@/lib/currencies";
import { toDb, tryToMinor } from "@/lib/money";
import { HOME_PATH, LOGIN_PATH } from "@/lib/routes";
import {
  type ChangePasswordInput,
  changePasswordSchema,
  deleteAccountSchema,
  type OnboardingInput,
  onboardingSchema,
  type UpdateProfileInput,
  updateProfileSchema,
} from "@/lib/schemas/profile";
import { createClient } from "@/lib/supabase/server";
import { supabaseEnv } from "@/lib/supabase/env";

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

/**
 * Saves the Settings form.
 *
 * Currency is written as a triple — code, symbol and decimal places — from
 * the one picked entry, because the exponent decides what every stored amount
 * *means*. Taking a symbol from the form and an exponent from somewhere else
 * is how ₹12.50 quietly becomes ₹1,250.
 */
export async function updateProfile(
  input: UpdateProfileInput,
): Promise<ActionResult<undefined>> {
  const parsed = parseInput(updateProfileSchema, input);
  if (!parsed.ok) return parsed;

  const currency = findCurrency(parsed.data.currencyCode);
  if (!currency) return fail("Pick a currency.", "currencyCode");

  const supabase = await createClient();
  const user = await requireUser(supabase);
  if (!user.ok) return user;

  // One call, one transaction. The currency can rewrite every amount the
  // user owns, so saving it separately from the name would leave a window
  // where the amounts had moved, the name had not, and the screen said the
  // save failed.
  const { error } = await supabase.rpc("update_settings", {
    p_display_name: parsed.data.displayName,
    p_week_start: parsed.data.weekStart,
    p_theme: parsed.data.theme,
    p_code: currency.code,
    p_symbol: currency.symbol,
    p_decimals: currency.decimals,
  });

  if (error) {
    if (error.code === "P0002") {
      return fail("Your session has expired. Sign in and try again.");
    }
    return failFromDb(error, "Could not save your settings.");
  }

  // Everything: the currency symbol is rendered on every screen there is.
  revalidatePath("/", "layout");
  return ok(undefined);
}

/**
 * Changes the password of the signed-in user.
 *
 * The current password is checked first by signing in with it. Supabase does
 * not require it, but without that step anyone who walks up to an unlocked
 * phone can lock the owner out of their own account.
 */
export async function changePassword(
  input: ChangePasswordInput,
): Promise<ActionResult<undefined>> {
  const parsed = parseInput(changePasswordSchema, input);
  if (!parsed.ok) return parsed;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return fail("Your session has expired. Sign in and try again.");
  }

  // Asking the auth server whether a password is right is an oracle, so the
  // attempt is claimed first and per user. GoTrue's own limit is per IP,
  // which counts the app server rather than the guesser.
  const { error: throttled } = await supabase.rpc("claim_password_attempt");

  if (throttled) {
    if (throttled.code === "53400") {
      return fail(
        "Too many attempts. Wait fifteen minutes and try again.",
        "currentPassword",
      );
    }
    return failFromDb(throttled, "Could not check your password.");
  }

  // Checked on a throwaway client that stores nothing: signing in on the
  // request's own client would hand the caller a different session as a side
  // effect of answering "is this your password?".
  const { url, anonKey } = supabaseEnv();
  const checker = createSupabaseClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error: wrongPassword } = await checker.auth.signInWithPassword({
    email: user.email,
    password: parsed.data.currentPassword,
  });

  if (wrongPassword) {
    // Only a 400 means "that is not the password". A rate limit from GoTrue
    // or an outage would otherwise tell someone holding the right password
    // that they had it wrong.
    const rejected =
      wrongPassword.status === 400 ||
      wrongPassword.code === "invalid_credentials";

    if (!rejected) {
      console.error("[settings]", wrongPassword.message);
      return fail(
        "Could not check your password just now. Try again in a moment.",
        "currentPassword",
      );
    }

    return fail("That is not your current password.", "currentPassword");
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.newPassword,
  });

  if (error) {
    // Supabase's own wording for a password it has seen in a breach list is
    // worth passing on; everything else gets a generic line.
    return fail(
      /weak|pwned|breach/i.test(error.message)
        ? "Pick a password that is harder to guess."
        : "Could not change your password. Try again.",
      "newPassword",
    );
  }

  return ok(undefined);
}

/**
 * Deletes the signed-in user and everything they own.
 *
 * The work is one SQL function that can only ever delete the caller's own
 * row — no service-role key lives in this app's environment, because a key
 * that can delete anybody is a much bigger thing to protect than a function
 * that can delete exactly one person.
 */
export async function deleteAccount(
  input: { confirm: string },
): Promise<ActionResult<{ next: string }>> {
  const parsed = parseInput(deleteAccountSchema, input);
  if (!parsed.ok) return parsed;

  const supabase = await createClient();
  const user = await requireUser(supabase);
  if (!user.ok) return user;

  const { error } = await supabase.rpc("delete_own_account");

  if (error) return failFromDb(error, "Could not delete your account.");

  // The session now points at a user that no longer exists, so it is cleared
  // rather than left to fail on the next request.
  await supabase.auth.signOut();

  revalidatePath("/", "layout");

  // Where to go, rather than a redirect thrown from here: a redirect out of a
  // Server Action reaches the caller as something that looks like an error,
  // and the only thing a caller can do with it is re-throw it.
  return ok({ next: LOGIN_PATH });
}
