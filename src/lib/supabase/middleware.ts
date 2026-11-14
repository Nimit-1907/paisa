import { type NextRequest, NextResponse } from "next/server";

import { createServerClient } from "@supabase/ssr";

import type { Database } from "@/types/database";

import { supabaseEnv } from "./env";

/**
 * Refreshes the Supabase session on every matched request and keeps the auth
 * cookies in sync between the request and the response.
 *
 * Returning `supabaseResponse` unmodified is important: a brand new
 * `NextResponse` would drop the refreshed cookies and sign the user out at
 * random.
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
  await supabase.auth.getUser();

  // Phase 2 (auth): once /login exists, redirect unauthenticated requests for
  // the (app) route group here, using the user returned by getUser().

  return supabaseResponse;
}
