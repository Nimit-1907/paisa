import { type NextRequest, NextResponse } from "next/server";

import type { AuthError, EmailOtpType } from "@supabase/supabase-js";

import { LOGIN_PATH, safeNextPath } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";

/**
 * Where every link Supabase mails out lands.
 *
 * Two shapes arrive here and both have to work:
 *   ?code=…                  PKCE — the signup/recovery link, exchanged for a
 *                            session using the verifier cookie set at signup
 *   ?token_hash=…&type=…     the older/template flow, verified as an OTP
 *
 * On success the user is redirected to `next`; on failure to /login with a
 * reason, never left on a blank page wondering what happened.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;

  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = safeNextPath(searchParams.get("next"));

  const backToLogin = (message: string) =>
    NextResponse.redirect(
      `${origin}${LOGIN_PATH}?error=${encodeURIComponent(message)}`,
    );

  // Supabase reports its own failures (expired link, used link) this way.
  const reportedError =
    searchParams.get("error_description") ?? searchParams.get("error");

  if (reportedError) {
    return backToLogin(reportedError);
  }

  const supabase = await createClient();

  let error: AuthError | null;

  if (code) {
    ({ error } = await supabase.auth.exchangeCodeForSession(code));
  } else if (tokenHash && type) {
    ({ error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash }));
  } else {
    return backToLogin(
      "That link is missing its confirmation code. Try requesting a new one.",
    );
  }

  if (error) {
    return backToLogin(error.message);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
