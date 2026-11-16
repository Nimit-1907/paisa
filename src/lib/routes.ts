/**
 * Route groups are a folder convention, they never appear in the URL, so
 * middleware cannot tell an (app) page from an (auth) one by looking at the
 * path. This is that mapping, in one place.
 */

/** Signed-in area. Everything here redirects to /login when there is no user. */
export const APP_PATHS = [
  "/records",
  "/analysis",
  "/budgets",
  "/accounts",
  "/categories",
  "/recurring",
  "/settings",
  "/import",
  "/export",
  "/about",
  "/more",
  "/onboarding",
] as const;

/** Signed-out area. A signed-in user is sent to the app instead. */
export const AUTH_PATHS = [
  "/login",
  "/signup",
  "/forgot-password",
] as const;

/**
 * Reachable either way: the recovery link signs the user in before they can
 * choose a new password, so bouncing a session off this page would make
 * password reset impossible.
 */
export const NEUTRAL_PATHS = ["/reset-password", "/auth"] as const;

/** Where a signed-in user lands. */
export const HOME_PATH = "/records";
export const LOGIN_PATH = "/login";
export const ONBOARDING_PATH = "/onboarding";

const matches = (paths: readonly string[], pathname: string) =>
  paths.some((path) => pathname === path || pathname.startsWith(`${path}/`));

export const isAppPath = (pathname: string) => matches(APP_PATHS, pathname);
export const isAuthPath = (pathname: string) => matches(AUTH_PATHS, pathname);
export const isNeutralPath = (pathname: string) =>
  matches(NEUTRAL_PATHS, pathname);

/**
 * Keeps an open redirect out of `?next=`.
 *
 * Checking for a leading "/" is not enough: browsers rewrite backslashes to
 * slashes for http(s), so "/\\evil.example.com" becomes "//evil.example.com"
 * and leaves the site. Resolving against a throwaway origin and insisting the
 * origin survives catches every shape of that, another host, another scheme,
 * a protocol-relative path.
 */
export function safeNextPath(next: string | null | undefined): string {
  if (!next) return HOME_PATH;

  // Only an absolute path on this site. A bare "evil.example.com" would
  // resolve to a harmless local path, but nothing legitimate sends one.
  if (!next.startsWith("/")) return HOME_PATH;

  // Control characters are stripped by browsers before the URL is parsed, so
  // they are only ever there to smuggle something past a check.
  if (/[\u0000-\u001f\u007f]/.test(next)) return HOME_PATH;

  const base = "http://paisa.invalid";

  try {
    const url = new URL(next, base);
    if (url.origin !== base) return HOME_PATH;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return HOME_PATH;
  }
}
