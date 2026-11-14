"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { type ActionResult, fail, ok, parseInput } from "@/lib/action-result";
import {
  type ResetRequestInput,
  type SignInInput,
  type SignUpInput,
  type UpdatePasswordInput,
  resetRequestSchema,
  signInSchema,
  signUpSchema,
  updatePasswordSchema,
} from "@/lib/schemas/auth";
import { HOME_PATH, LOGIN_PATH, safeNextPath } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";

/**
 * The origin Supabase should build email links from.
 *
 * Read from configuration, never from the request's Origin or Host header:
 * those are attacker-controlled, and a forged one turns a genuine
 * password-reset mail into a link that hands the victim's code to someone
 * else's domain. Set NEXT_PUBLIC_SITE_URL per environment.
 */
function siteOrigin(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");

  return "http://localhost:3000";
}

export type SignUpData = { needsEmailConfirmation: boolean; email: string };

export async function signUp(
  input: SignUpInput,
): Promise<ActionResult<SignUpData>> {
  const parsed = parseInput(signUpSchema, input);
  if (!parsed.ok) return parsed;

  const supabase = await createClient();
  const origin = siteOrigin();

  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      // Lands on the callback, which swaps the code for a session and sends
      // the new user into onboarding.
      emailRedirectTo: `${origin}/auth/callback?next=/onboarding`,
      data: parsed.data.displayName
        ? { display_name: parsed.data.displayName }
        : undefined,
    },
  });

  if (error) {
    return fail(authMessage(error.message));
  }

  // Supabase returns a user with an empty identities array when the address
  // is already registered. Deliberately not surfaced: answering differently
  // here would let anyone test an address for an account, which is the same
  // leak requestPasswordReset is careful to avoid. The cost is that someone
  // who forgot they have an account is told to check their email — the sign
  // in and reset links are right there on the next screen.
  return ok({
    needsEmailConfirmation: data.session === null,
    email: parsed.data.email,
  });
}

export async function signIn(
  input: SignInInput,
): Promise<ActionResult<{ next: string }>> {
  const parsed = parseInput(signInSchema, input);
  if (!parsed.ok) return parsed;

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    return fail(authMessage(error.message));
  }

  revalidatePath("/", "layout");
  return ok({ next: safeNextPath(parsed.data.next) });
}

export async function signOut(): Promise<never> {
  const supabase = await createClient();
  await supabase.auth.signOut();

  revalidatePath("/", "layout");
  redirect(LOGIN_PATH);
}

export async function requestPasswordReset(
  input: ResetRequestInput,
): Promise<ActionResult<undefined>> {
  const parsed = parseInput(resetRequestSchema, input);
  if (!parsed.ok) return parsed;

  const supabase = await createClient();
  const origin = siteOrigin();

  const { error } = await supabase.auth.resetPasswordForEmail(
    parsed.data.email,
    { redirectTo: `${origin}/auth/callback?next=/reset-password` },
  );

  if (error) {
    if (/rate limit|too many/i.test(error.message)) {
      return fail("Too many emails just now. Try again in a minute.");
    }

    // Everything else answers the same way the success path does: telling an
    // anonymous caller which addresses are registered is an
    // account-enumeration gift. Logged, though — otherwise a broken SMTP
    // config looks exactly like a delivered email.
    console.error("[auth] password reset failed:", error.message);
  }

  return ok(undefined);
}

export async function updatePassword(
  input: UpdatePasswordInput,
): Promise<ActionResult<{ next: string }>> {
  const parsed = parseInput(updatePasswordSchema, input);
  if (!parsed.ok) return parsed;

  const supabase = await createClient();

  // The recovery link already signed this user in; without that session there
  // is nothing to update.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return fail(
      "That reset link has expired. Request a new one and try again.",
    );
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (error) {
    return fail(authMessage(error.message));
  }

  revalidatePath("/", "layout");
  return ok({ next: HOME_PATH });
}

/**
 * Supabase's wording is terse and can carry internals, so only the cases we
 * recognise are shown. Anything else is logged and answered generically
 * rather than forwarded to the browser verbatim.
 */
function authMessage(message: string): string {
  const normalised = message.toLowerCase();

  if (normalised.includes("invalid login credentials")) {
    return "That email and password do not match.";
  }
  if (normalised.includes("email not confirmed")) {
    return "Confirm your email first — check your inbox for the link.";
  }
  if (normalised.includes("same password")) {
    return "Choose a password you have not used here before.";
  }
  if (normalised.includes("weak password") || normalised.includes("password should")) {
    return "That password is too easy to guess. Try a longer one.";
  }
  if (normalised.includes("rate limit") || normalised.includes("too many")) {
    return "Too many attempts just now. Try again in a minute.";
  }

  console.error("[auth]", message);
  return "Something went wrong. Please try again.";
}
