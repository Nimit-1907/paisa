import { type NextRequest, NextResponse } from "next/server";

import { createServerClient } from "@supabase/ssr";

import {
  LOGIN_PATH,
  isAppPath,
  isAuthPath,
  safeNextPath,
} from "@/lib/routes";
import type { Database } from "@/types/database";

import { supabaseEnv } from "./env";

/**
 * Refreshes the Supabase session on every matched request, keeps the auth
 * cookies in sync between request and response, and decides who may see what.
 *
 * Returning `supabaseResponse` (rather than a fresh NextResponse) is
 * important: a new response object drops the refreshed cookies and signs the
 * user out at random. The redirects below copy those cookies across for the
 * same reason.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const { url, anonKey } = supabaseEnv();

  const supabase = createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        supabaseResponse = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          supabaseResponse.cookies.set(name, value, options);
        }
      },
    },
  });

  // Do not run code between createServerClient and getUser(): this call is
  // what refreshes the token and writes the cookies above.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname, search } = request.nextUrl;

  if (!user && isAppPath(pathname)) {
    const target = request.nextUrl.clone();
    target.pathname = LOGIN_PATH;
    target.search = "";
    // Remember where they were headed, so signing in finishes the journey.
    target.searchParams.set("next", `${pathname}${search}`);
    return redirectKeepingCookies(target, supabaseResponse);
  }

  if (user && isAuthPath(pathname)) {
    const target = request.nextUrl.clone();
    target.pathname = safeNextPath(request.nextUrl.searchParams.get("next"));
    target.search = "";
    return redirectKeepingCookies(target, supabaseResponse);
  }

  return supabaseResponse;
}

/**
 * A redirect built from scratch would throw away the Set-Cookie headers the
 * refresh just produced, so the next request would arrive unauthenticated and
 * bounce again — the classic redirect loop.
 */
function redirectKeepingCookies(target: URL, carrying: NextResponse) {
  const response = NextResponse.redirect(target);

  for (const cookie of carrying.cookies.getAll()) {
    response.cookies.set(cookie);
  }

  return response;
}
