/**
 * A recurring rule as every screen sees it, and the pure functions over it.
 *
 * Separate from lib/queries/recurring.ts, which is server-only: the rule
 * sheet and the Upcoming strip are Client Components, and a "server-only"
 * import would refuse to bundle even for a type.
 */

import {
  type RecurrenceSchedule,
  occurrencesBetween,
  upcoming,
} from "@/lib/recurrence";
import type { Database } from "@/types/database";

export type RecurringRule = {
  id: string;
  type: Database["public"]["Enums"]["transaction_type"];
  /** Minor units as text: an RSC payload cannot carry a BigInt. */
  amount: string;
  note: string | null;
  accountId: string;
  accountName: string;
  toAccountId: string | null;
  toAccountName: string | null;
  categoryId: string | null;
  categoryName: string | null;
  categoryIcon: string | null;
  categoryColor: string | null;
  frequency: Database["public"]["Enums"]["recurrence_frequency"];
  interval: number;
  startDate: string;
  anchorDay: number | null;
  endDate: string | null;
  nextRunOn: string;
  lastRunOn: string | null;
  skippedDates: string[];
  active: boolean;
  /** The next date it is actually due: null once it has nothing left. */
  dueOn: string | null;
  /** How many records it has created, for the delete dialog. */
  recordCount: number;
};

/**
 * What to call a rule.
 *
 * The note if there is one, then the two accounts for a transfer — which has
 * no category to fall back on — then the category.
 */
export function ruleTitle(rule: {
  note: string | null;
  type: RecurringRule["type"];
  accountName: string;
  toAccountName: string | null;
  categoryName: string | null;
}): string {
  if (rule.note) return rule.note;

  if (rule.type === "transfer") {
    return `${rule.accountName} → ${rule.toAccountName ?? "—"}`;
  }

  return rule.categoryName ?? "Recurring";
}

/** The schedule half of a rule, for lib/recurrence. */
export function scheduleOf(rule: {
  frequency: RecurringRule["frequency"];
  interval: number;
  startDate: string;
  anchorDay: number | null;
  endDate: string | null;
  skippedDates: string[];
}): RecurrenceSchedule {
  return {
    frequency: rule.frequency,
    interval: rule.interval,
    startDate: rule.startDate,
    anchorDay: rule.anchorDay,
    endDate: rule.endDate,
    skippedDates: rule.skippedDates,
  };
}

/** The next few dates one rule is due, for its detail page. */
export function upcomingFor(rule: RecurringRule, count = 5): string[] {
  if (!rule.active) return [];
  return upcoming(scheduleOf(rule), count, rule.nextRunOn);
}

export type UpcomingOccurrence = {
  /** `ruleId:date` — a scheduled item has no row of its own yet. */
  key: string;
  ruleId: string;
  on: string;
  rule: RecurringRule;
};

/**
 * Everything due between two dates, across every active rule.
 *
 * Computed, not inserted: showing the week ahead must not create the records
 * early, and a user who never opens the app on the 1st should still see the
 * same list on the 3rd.
 */
export function upcomingBetween(
  rules: RecurringRule[],
  from: string,
  to: string,
  /** `ruleId:yyyy-mm-dd` keys that already have a record. */
  created: ReadonlySet<string> = new Set(),
): UpcomingOccurrence[] {
  const items: UpcomingOccurrence[] = [];

  for (const rule of rules) {
    if (!rule.active) continue;

    // Starting at the cursor, not at `from`: today's occurrence has usually
    // been created already by the time this renders, and offering "Pay now"
    // for a record that exists is just a confusing no-op.
    const start = rule.nextRunOn > from ? rule.nextRunOn : from;

    for (const on of occurrencesBetween(scheduleOf(rule), start, to)) {
      const key = `${rule.id}:${on}`;
      if (created.has(key)) continue;

      items.push({ key, ruleId: rule.id, on, rule });
    }
  }

  return items.sort(
    (a, b) => a.on.localeCompare(b.on) || a.rule.id.localeCompare(b.rule.id),
  );
}
