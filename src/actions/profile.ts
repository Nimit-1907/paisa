"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import {
  type ActionResult,
  fail,
  failFromDb,
  ok,
  parseInput,
} from "@/lib/action-result";
import { requireUser } from "@/lib/auth-guard";
import { DEFAULT_COLOR, colorForName } from "@/lib/colors";
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

  const {
    displayName,
    currencyCode,
    accountName,
    openingBalance,
    bankName,
    bankBalance,
  } = parsed.data;

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

  // Parsed before anything is written, so a typo in the second box does not
  // leave the first account updated and setup half done.
  const bankMinor = bankName
    ? bankBalance
      ? tryToMinor(bankBalance, currency.decimals)
      : 0n
    : null;

  if (bankName && bankMinor === null) {
    return fail("That bank balance is not a number.", "bankBalance");
  }

  // Two accounts sharing one name is refused by `onboardingSchema`, which is
  // where that rule lives so the form and this action cannot disagree about
  // it. Without it, the lookup below would find the first account and
  // overwrite its opening balance with the bank's.

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
      color: DEFAULT_COLOR,
      initial_balance: toDb(minor),
      sort_order: 0,
    });

    if (error) return fail(error.message);
  }

  // The optional second account, after the first one and still before
  // display_name: the same ordering argument - nothing marks setup finished
  // until every account write has landed.
  //
  // Matched on name first, because this whole action has to survive being
  // run twice. Setup is not finished until the profile write below lands, so
  // anything that fails after this point - a dropped connection, a double
  // tap on Start tracking - leaves the user on this screen to try again. A
  // plain insert would hand them a second HDFC each time.
  if (bankName && bankMinor !== null) {
    let lookup = supabase
      .from("accounts")
      .select("id")
      .eq("user_id", user.id)
      .eq("name", bankName);

    // Belt and braces over the name check above: whatever the names are,
    // this must never find the account the first step just wrote.
    if (account) lookup = lookup.neq("id", account.id);

    const { data: existing, error: lookupError } = await lookup.maybeSingle();

    if (lookupError) return fail(lookupError.message);

    const { error } = existing
      ? await supabase
          .from("accounts")
          .update({ initial_balance: toDb(bankMinor) })
          .eq("id", existing.id)
      : await supabase.from("accounts").insert({
          user_id: user.id,
          name: bankName,
          type: "bank",
          icon: "Landmark",
          color: colorForName(bankName),
          initial_balance: toDb(bankMinor),
          sort_order: 1,
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

  /*
   * No revalidation here, deliberately.
   *
   * Setup now ends on a welcome screen rather than a redirect, and this page
   * sends anyone whose setup is done straight to the app — so revalidating
   * from inside the action tears that screen off the display a moment after
   * it appears. The button on it navigates, and the destination is rendered
   * per request anyway.
   */
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
export async function deleteAccount(input: {
  confirm: string;
}): Promise<ActionResult<{ next: string }>> {
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

/**
 * The three things the interface remembers about a person.
 *
 * Preferences and one-time notes, not data: a direct update rather than a
 * function, because row level security and the column grants already say
 * exactly which rows and which columns a signed-in user may touch, and a
 * SECURITY DEFINER function would only be re-stating that in PL/pgSQL.
 */
async function setPreference(
  patch: Partial<{
    haptics: boolean;
    recap_seen_for: string;
    first_record_seen: boolean;
    show_paise: boolean;
  }>,
  message: string,
): Promise<ActionResult<undefined>> {
  const supabase = await createClient();
  const user = await requireUser(supabase);
  if (!user.ok) return user;

  const { error } = await supabase
    .from("profiles")
    .update(patch)
    .eq("id", user.id);

  if (error) return failFromDb(error, message);

  return ok(undefined);
}

/**
 * Leaves the welcome screen for the first record.
 *
 * Rebuilding the shell and navigating are one step on purpose. Doing them
 * separately is a race: revalidating while still on /onboarding invalidates
 * that page too, and this page sends anyone whose setup is done straight to
 * the app — so the welcome screen can be torn off the display underneath the
 * button being pressed. As one action the order is fixed: throw away the
 * cache that predates the name and currency just chosen, then leave.
 */
export async function startTracking(): Promise<void> {
  revalidatePath("/", "layout");
  redirect(`${HOME_PATH}?add=1`);
}

/** The Settings toggle: should saving and deleting buzz the phone? */
export async function setHaptics(
  enabled: boolean,
): Promise<ActionResult<undefined>> {
  if (typeof enabled !== "boolean") return fail("Could not save that.");

  const saved = await setPreference(
    { haptics: enabled },
    "Could not save that setting.",
  );

  // The only one of the three the shell renders: it hands this value to
  // every client component that can buzz.
  if (saved.ok) revalidatePath("/", "layout");

  return saved;
}

/** The Settings toggle: should lists draw ".00"? */
export async function setShowPaise(
  enabled: boolean,
): Promise<ActionResult<undefined>> {
  if (typeof enabled !== "boolean") return fail("Could not save that.");

  const saved = await setPreference(
    { show_paise: enabled },
    "Could not save that setting.",
  );

  // Every amount on every screen reads this, so the whole shell has to be
  // rebuilt rather than just the Settings page.
  if (saved.ok) revalidatePath("/", "layout");

  return saved;
}

/**
 * The first day of a month that has already started.
 *
 * `new Date("9999-99-99")` is Invalid Date rather than a throw, and the
 * regex alone would let it through to the column.
 */
const monthStartSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-01$/, "not a month")
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00Z`);
    return (
      !Number.isNaN(parsed.getTime()) &&
      parsed.toISOString().slice(0, 10) === value &&
      parsed.getTime() <= Date.now()
    );
  }, "not a month that has happened");

/** Called once, the first time somebody saves a record. */
export async function markFirstRecordSeen(): Promise<ActionResult<undefined>> {
  return setPreference(
    { first_record_seen: true },
    "Could not save that. It is only a note to ourselves.",
  );
}

/**
 * Hides this month's recap card.
 *
 * Takes the month it is dismissing rather than "now": the card is for the
 * month that just ended, and a clock a few seconds out should not be able to
 * dismiss the wrong one.
 */
export async function dismissRecap(
  month: string,
): Promise<ActionResult<undefined>> {
  // The first of a real month, and not one that has not happened yet: the
  // column decides whether a recap is ever shown again, so a value the
  // client made up should not reach it.
  const parsed = monthStartSchema.safeParse(month);
  if (!parsed.success) return fail("Could not dismiss that.");

  return setPreference(
    { recap_seen_for: parsed.data },
    "Could not dismiss that.",
  );
}
