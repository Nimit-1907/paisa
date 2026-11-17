import "server-only";

import { cache } from "react";

import { DEFAULT_TIME_ZONE } from "@/lib/month-param";
import { getProfile } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";

import { localToday } from "@/lib/dates";

export { localToday };

/**
 * Creates whatever the user's recurring rules and investment schedules owe,
 * at most once a day.
 *
 * There is no cron in a local Supabase stack and no server to run one on, so
 * the app shell is the scheduler: the first page a user opens on a new day
 * catches the rules up, including every occurrence missed while the app was
 * closed. README documents the pg_cron version for a deployment that wants it.
 *
 * Two things make that safe to do from a render. `process_due_recurring()` is
 * idempotent, the unique index on (recurring_rule_id, occurrence day) refuses
 * a second copy, so two tabs opening at once cannot double-charge the month.
 * And `cache()` keeps it to one call per request however many places ask.
 *
 * The generator runs before the stamp is written, deliberately: a failure then
 * leaves the day unclaimed and the next navigation tries again, where stamping
 * first would silently skip a day's records.
 */
export type DueRun = {
  /** Records the recurring rules created. */
  records: number;
  /** Investment instalments the schedules posted. */
  instalments: number;
  /** Open deposits whose maturity date has arrived, for the payout prompt. */
  matured: { id: string; name: string }[];
};

const NOTHING: DueRun = { records: 0, instalments: 0, matured: [] };

export const runDueRecurring = cache(async (): Promise<DueRun> => {
  const profile = await getProfile();
  if (!profile) return NOTHING;

  const today = localToday(profile.timezone ?? DEFAULT_TIME_ZONE);
  if (profile.last_recurring_check === today) return NOTHING;

  const supabase = await createClient();

  const [recurring, investments, matured] = await Promise.all([
    supabase.rpc("process_due_recurring"),
    // The investments ledger keeps its own schedules, posted under the same
    // once-a-day stamp so a new day costs one round of catch-up, not two.
    supabase.rpc("process_due_investments"),
    supabase
      .from("investments")
      .select("id, name")
      .eq("status", "open")
      .lte("maturity_date", today)
      .order("maturity_date"),
  ]);

  if (recurring.error) {
    // Never fatal: a user who cannot reach their rules should still see their
    // records. The toast would be noise, so this goes to the log instead.
    console.error("[recurring]", recurring.error.message);
    return NOTHING;
  }

  if (investments.error) console.error("[investments]", investments.error.message);
  if (matured.error) console.error("[investments]", matured.error.message);

  const { error: stampError } = await supabase
    .from("profiles")
    .update({ last_recurring_check: today })
    .eq("id", profile.id);

  if (stampError) console.error("[recurring]", stampError.message);

  return {
    records: Number(recurring.data ?? 0),
    instalments: investments.error ? 0 : Number(investments.data ?? 0),
    matured: matured.data ?? [],
  };
});
