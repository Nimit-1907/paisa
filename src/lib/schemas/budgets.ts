import { z } from "zod";

/**
 * What the budget sheet may send.
 *
 * The month is a `yyyy-mm` rather than a date: a budget belongs to a month,
 * not to a day in it, and letting a day through would mean two callers
 * disagreeing about which one the row is keyed on. The RPC normalises
 * anything it is given, and this makes sure nothing needs normalising.
 */

const uuid = z.string().uuid();

export const budgetMonthSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Pick a month.");

export const setBudgetSchema = z.object({
  categoryId: uuid,
  month: budgetMonthSchema,
  /** Decimal text, parsed with the user's decimal places. */
  amount: z.string().trim().min(1, "Enter an amount."),
  /** Carry the same amount into the months after this one. */
  applyForward: z.boolean().default(false),
});

export const deleteBudgetSchema = z.object({
  categoryId: uuid,
  month: budgetMonthSchema,
});

/**
 * A validated `yyyy-mm` as the first of that month, which is how the column
 * stores it. Only ever called on a month `budgetMonthSchema` has accepted.
 */
export function monthStartOf(month: string): string {
  return `${month}-01`;
}

export type SetBudgetInput = z.input<typeof setBudgetSchema>;

/** How far ahead "apply to all future months" reaches. */
export const APPLY_FORWARD_MONTHS = 12;

/** Where a category sits against its budget. */
export type BudgetTone = "under" | "close" | "over";

/**
 * Comfortable, close, or over.
 *
 * 80% is where the warning starts, which is early enough to change something
 * and late enough not to cry wolf every month. Exactly on budget counts as
 * close rather than over, spending the last rupee of a limit is not a
 * failure.
 */
export function budgetTone(spent: bigint, budget: bigint): BudgetTone {
  if (budget <= 0n) return "under";
  if (spent > budget) return "over";
  // 80% without floats: spent/budget >= 0.8 is the same as 5*spent >= 4*budget.
  if (5n * spent >= 4n * budget) return "close";
  return "under";
}

/** 0–100 for a bar, and past 100 only as far as the bar can show. */
export function budgetPercent(spent: bigint, budget: bigint): number {
  if (budget <= 0n) return 0;

  // Scaled in BigInt first: an amount above 2^53 paise would lose precision
  // the moment it became a Number.
  const scaled = Number((spent * 1000n) / budget) / 10;
  return Math.min(999, Math.max(0, scaled));
}
