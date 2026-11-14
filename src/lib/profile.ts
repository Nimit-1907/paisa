import "server-only";

import { cache } from "react";

import type { CurrencySettings } from "@/lib/money";
import { DEFAULT_CURRENCY_SETTINGS } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];

/**
 * The signed-in user, validated against the auth server.
 *
 * `cache()` keeps the layout, the page and anything below them to one call per
 * request instead of each firing their own.
 */
export const getSessionUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

/** The signed-in user's profile row, or null. */
export const getProfile = cache(async (): Promise<Profile | null> => {
  const user = await getSessionUser();
  if (!user) return null;

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  // A failed query must not read as "no profile": the layout would take that
  // for an un-onboarded user and send them back through setup, where they
  // would overwrite the name and currency they already chose.
  if (error) {
    throw new Error(`Could not load the profile: ${error.message}`);
  }

  return data;
});

/**
 * Currency settings for the current user, falling back to the app default so
 * a Server Component can format money before onboarding has run.
 */
export function currencyOf(profile: Profile | null): CurrencySettings {
  if (!profile) return DEFAULT_CURRENCY_SETTINGS;

  return {
    code: profile.currency_code,
    symbol: profile.currency_symbol,
    decimals: profile.decimal_places,
  };
}

/** Onboarding is "done" once the user has told us their name. */
export function needsOnboarding(profile: Profile | null): boolean {
  return profile === null || profile.display_name === null;
}
