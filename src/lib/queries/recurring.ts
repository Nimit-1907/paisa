import "server-only";

import { instantToLocal, localToInstant } from "@/lib/dates";
import { addDays } from "@/lib/recurrence";
import { fromDb } from "@/lib/money";
import { nextOccurrence } from "@/lib/recurrence";
import { type RecurringRule, scheduleOf } from "@/lib/recurring-rule";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID.test(value);
}

export type {
  RecurringRule,
  UpcomingOccurrence,
} from "@/lib/recurring-rule";

const SELECT = `
  id, type, amount, note, frequency, interval_count, start_date, anchor_day,
  end_date, next_run_on, last_run_on, skipped_dates, active,
  account_id, to_account_id, category_id,
  category:categories(name, icon, color),
  account:accounts!recurring_rules_account_id_fkey(name),
  to_account:accounts!recurring_rules_to_account_id_fkey(name)
`;

type JoinedRule = {
  id: string;
  type: Database["public"]["Enums"]["transaction_type"];
  amount: number;
  note: string | null;
  frequency: Database["public"]["Enums"]["recurrence_frequency"];
  interval_count: number;
  start_date: string;
  anchor_day: number | null;
  end_date: string | null;
  next_run_on: string;
  last_run_on: string | null;
  skipped_dates: string[] | null;
  active: boolean;
  account_id: string;
  to_account_id: string | null;
  category_id: string | null;
  category: { name: string; icon: string | null; color: string | null } | null;
  account: { name: string } | null;
  to_account: { name: string } | null;
};

function toRule(row: JoinedRule, recordCount = 0): RecurringRule {
  const rule = {
    id: row.id,
    type: row.type,
    amount: fromDb(row.amount).toString(),
    note: row.note,
    accountId: row.account_id,
    accountName: row.account?.name ?? "Account",
    toAccountId: row.to_account_id,
    toAccountName: row.to_account?.name ?? null,
    categoryId: row.category_id,
    categoryName: row.category?.name ?? null,
    categoryIcon: row.category?.icon ?? null,
    categoryColor: row.category?.color ?? null,
    frequency: row.frequency,
    interval: row.interval_count,
    startDate: row.start_date,
    anchorDay: row.anchor_day,
    endDate: row.end_date,
    nextRunOn: row.next_run_on,
    lastRunOn: row.last_run_on,
    skippedDates: row.skipped_dates ?? [],
    active: row.active,
  };

  return {
    ...rule,
    // next_run_on is a cursor, which an edit can leave between two
    // occurrences; this is the date the user is actually told.
    dueOn: nextOccurrence(scheduleOf(rule), rule.nextRunOn),
    recordCount,
  };
}

/** Every rule the user has, soonest first, active before paused. */
export async function getRecurringRules(): Promise<RecurringRule[]> {
  const supabase = await createClient();

  const [rules, usage] = await Promise.all([
    supabase
      .from("recurring_rules")
      .select(SELECT)
      .order("active", { ascending: false })
      .order("next_run_on", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase.from("recurring_rule_usage").select("rule_id, transaction_count"),
  ]);

  if (rules.error) throw new Error(rules.error.message);
  if (usage.error) throw new Error(usage.error.message);

  const counts = new Map(
    usage.data.map((row) => [row.rule_id, row.transaction_count ?? 0]),
  );

  return (rules.data as unknown as JoinedRule[]).map((row) =>
    toRule(row, counts.get(row.id) ?? 0),
  );
}

/** One rule, or null when it is not the caller's. */
export async function getRecurringRule(
  id: string,
): Promise<RecurringRule | null> {
  if (!isUuid(id)) return null;

  const supabase = await createClient();

  const [rule, usage] = await Promise.all([
    supabase.from("recurring_rules").select(SELECT).eq("id", id).maybeSingle(),
    supabase
      .from("recurring_rule_usage")
      .select("transaction_count")
      .eq("rule_id", id)
      .maybeSingle(),
  ]);

  if (rule.error) throw new Error(rule.error.message);
  if (!rule.data) return null;

  return toRule(
    rule.data as unknown as JoinedRule,
    usage.data?.transaction_count ?? 0,
  );
}

/**
 * The occurrences that already have a record, as `ruleId:yyyy-mm-dd`.
 *
 * The upcoming list is computed from the schedule, which knows nothing about
 * what has been written. Normally the cursor keeps the two in step, but a rule
 * can owe an occurrence while a later one has been paid early, and offering
 * "Pay now" for a record that already exists is a confusing no-op.
 */
export async function getCreatedOccurrences(
  ruleIds: string[],
  from: string,
  to: string,
  timeZone: string,
): Promise<Set<string>> {
  const ids = ruleIds.filter(isUuid);
  if (ids.length === 0) return new Set();

  const start = localToInstant(`${from}T00:00`, timeZone);
  // Exclusive, at the start of the day after: a record at 23:59:30 on the
  // last day still belongs to that day.
  const end = localToInstant(`${addDays(to, 1)}T00:00`, timeZone);
  if (!start || !end) return new Set();

  const supabase = await createClient();

  // Scoped to the rules on screen, so the result is bounded by their number
  // times the length of the window and cannot quietly hit PostgREST's row
  // cap — which would report an occurrence as uncreated when it is not.
  const { data, error } = await supabase
    .from("transactions")
    .select("recurring_rule_id, occurred_at")
    .in("recurring_rule_id", ids)
    .gte("occurred_at", start.toISOString())
    .lt("occurred_at", end.toISOString())
    .limit(1000);

  if (error) throw new Error(error.message);

  return new Set(
    data.map(
      (row) =>
        `${row.recurring_rule_id}:${instantToLocal(
          row.occurred_at,
          timeZone,
        ).slice(0, 10)}`,
    ),
  );
}

export type GeneratedRecord = {
  id: string;
  amount: string;
  note: string | null;
  occurredAt: string;
};

/** What a rule has created so far, newest first. */
export async function getRuleTransactions(
  ruleId: string,
  limit = 24,
): Promise<GeneratedRecord[]> {
  if (!isUuid(ruleId)) return [];

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("transactions")
    .select("id, amount, note, occurred_at")
    .eq("recurring_rule_id", ruleId)
    .order("occurred_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);

  return data.map((row) => ({
    id: row.id,
    amount: fromDb(row.amount).toString(),
    note: row.note,
    occurredAt: row.occurred_at,
  }));
}

