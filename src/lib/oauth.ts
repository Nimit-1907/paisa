import { safeNextPath } from "@/lib/routes";

/**
 * Where Google (through Supabase) sends someone back to: the auth callback,
 * which trades the code for a session, then on to `next`. `next` goes
 * through safeNextPath, so a crafted link cannot bounce a fresh session
 * off-site.
 */
export function oauthCallbackUrl(
  origin: string,
  next: string | null | undefined,
): string {
  return `${origin}/auth/callback?next=${encodeURIComponent(safeNextPath(next))}`;
}

/**
 * Whether "Continue with Google" is offered.
 *
 * Off until the Google OAuth client exists and Supabase has its keys
 * (docs/auth-google.md); a button that leads to a provider error is worse
 * than no button. Callers pass process.env.AUTH_GOOGLE, a server-only
 * variable read per request by the login and signup pages and the action
 * alike, so the button and the action cannot disagree.
 */
export function googleSignInEnabled(flag: string | undefined): boolean {
  return flag?.trim().toLowerCase() === "true";
}
