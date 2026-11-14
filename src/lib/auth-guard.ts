import "server-only";

import type { createClient } from "@/lib/supabase/server";

export type UserGuard =
  | { ok: true; id: string }
  | { ok: false; error: string; field?: string };

/**
 * The signed-in user, or the failure a Server Action should return.
 *
 * RLS is the real guard — rls.test.sql proves a user cannot touch another's
 * rows — but having the id lets a mutation filter on user_id as well, which
 * is what makes "no row matched" mean something rather than looking like
 * success.
 */
export async function requireUser(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<UserGuard> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      error: "Your session has expired. Sign in and try again.",
    };
  }

  return { ok: true, id: user.id };
}
