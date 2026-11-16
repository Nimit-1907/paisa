"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { type ActionResult, fail, ok, parseInput } from "@/lib/action-result";
import {
  type ResetRequestInput,
  type SignInInput,
  type SignUpInput,
  type UpdatePasswordInput,
  type GoogleSignInInput,
  googleSignInSchema,
  resetRequestSchema,
  signInSchema,
  signUpSchema,
  updatePasswordSchema,
} from "@/lib/schemas/auth";
import { HOME_PATH, LOGIN_PATH, safeNextPath } from "@/lib/routes";
import { googleSignInEnabled, oauthCallbackUrl } from "@/lib/oauth";
import { siteOrigin } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";

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
  // who forgot they have an account is told to check their email, the sign
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
    // account-enumeration gift. Logged, though, otherwise a broken SMTP
    // config looks exactly like a delivered email.
    console.error("[auth] password reset failed:", error.message);
  }

  return ok(undefined);
}

/**
 * Send the confirmation email again.
 *
 * Answers the same way whatever happens, for the same reason
 * {@link requestPasswordReset} does: a different answer for "no such
 * account" or "already confirmed" would let an anonymous caller test
 * addresses one at a time. The rate limit is the one thing worth saying out
 * loud, because it is the one a person can do something about, wait.
 */
export async function resendConfirmation(
  input: ResetRequestInput,
): Promise<ActionResult<undefined>> {
  const parsed = parseInput(resetRequestSchema, input);
  if (!parsed.ok) return parsed;

  const supabase = await createClient();
  const origin = siteOrigin();

  const { error } = await supabase.auth.resend({
    type: "signup",
    email: parsed.data.email,
    options: {
      emailRedirectTo: `${origin}/auth/callback?next=/onboarding`,
    },
  });

  if (error) {
    if (/rate limit|too many/i.test(error.message)) {
      return fail("Too many emails just now. Try again in a minute.");
    }

    // Logged rather than shown, so a broken SMTP config does not look
    // exactly like a delivered email.
    console.error("[auth] resend failed:", error.message);
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
    return "Confirm your email first. Check your inbox for the link.";
  }
  if (normalised.includes("same password")) {
    return "Choose a password you have not used here before.";
  }
  if (
    normalised.includes("weak password") ||
    normalised.includes("password should")
  ) {
    return "That password is too easy to guess. Try a longer one.";
  }
  if (normalised.includes("rate limit") || normalised.includes("too many")) {
    return "Too many attempts just now. Try again in a minute.";
  }

  console.error("[auth]", message);
  return "Something went wrong. Please try again.";
}

/**
 * Start "Continue with Google": the Google URL to send the browser to.
 *
 * Returned rather than redirected to, so the button can say what went
 * wrong in a toast instead of leaving the page. The PKCE verifier is kept
 * in a cookie by the server client; /auth/callback trades the code back.
 */
export async function startGoogleSignIn(
  input: GoogleSignInInput,
): Promise<ActionResult<{ url: string }>> {
  if (!googleSignInEnabled(process.env.AUTH_GOOGLE)) {
    return fail("Google sign-in is not set up yet.");
  }

  // Callable by anyone, like every server action: the shape is checked
  // here, not trusted from the type.
  const parsed = parseInput(googleSignInSchema, input);
  if (!parsed.ok) return parsed;
  const { next } = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: oauthCallbackUrl(siteOrigin(), next) },
  });

  if (error || !data.url) {
    console.error("[auth] google sign-in failed:", error?.message);
    return fail("Could not reach Google. Try again in a moment.");
  }

  return ok({ url: data.url });
}
