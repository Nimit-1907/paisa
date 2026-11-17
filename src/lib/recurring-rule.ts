/**
 * A recurring rule as every screen sees it, and the pure functions over it.
 *
 * Separate from lib/queries/recurring.ts, which is server-only: the rule
 * sheet and the Recurring screen are Client Components, and a "server-only"
 * import would refuse to bundle even for a type.
 */

import { type RecurrenceSchedule, upcoming } from "@/lib/recurrence";
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
  /** One of the eight Phase 14 tint keys. */
  categoryTint: string | null;
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
 * The note if there is one, then the two accounts for a transfer, which has
 * no category to fall back on, then the category.
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
    return `${rule.accountName} → ${rule.toAccountName ?? "None"}`;
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
