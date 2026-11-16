import { z } from "zod";

import {
  RECURRENCE_FREQUENCIES,
  TRANSACTION_TYPES,
  type TransactionType,
} from "@/lib/schemas/transactions";

/**
 * What the recurring screens may send.
 *
 * The shape rules are the same ones transactions obey, a transfer needs a
 * destination and no category, an income or expense needs a category, because
 * a rule is a transaction template and `recurring_rules_shape_check` holds it
 * to exactly that.
 */

const uuid = z.string().uuid();
const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2026-12-31");

function checkShape(
  value: {
    type: TransactionType;
    accountId: string;
    toAccountId?: string | null;
    categoryId?: string | null;
  },
  ctx: z.RefinementCtx,
) {
  if (value.type === "transfer") {
    if (!value.toAccountId) {
      ctx.addIssue({
        code: "custom",
        path: ["toAccountId"],
        message: "Choose the account the money goes to.",
      });
    } else if (value.toAccountId === value.accountId) {
      ctx.addIssue({
        code: "custom",
        path: ["toAccountId"],
        message: "A transfer needs two different accounts.",
      });
    }

    if (value.categoryId) {
      ctx.addIssue({
        code: "custom",
        path: ["categoryId"],
        message: "Transfers move money between accounts, so they have no category.",
      });
    }

    return;
  }

  if (!value.categoryId) {
    ctx.addIssue({
      code: "custom",
      path: ["categoryId"],
      message: "Pick a category.",
    });
  }

  if (value.toAccountId) {
    ctx.addIssue({
      code: "custom",
      path: ["toAccountId"],
      message: "Only a transfer has a destination account.",
    });
  }
}

const ruleFields = {
  type: z.enum(TRANSACTION_TYPES),
  /** Whatever the keypad holds; parsed with the user's decimal places. */
  amount: z.string().trim().min(1, "Enter an amount."),
  accountId: uuid,
  toAccountId: uuid.nullable().optional(),
  categoryId: uuid.nullable().optional(),
  note: z
    .string()
    .trim()
    .max(500, "That note is a bit long.")
    .nullable()
    .optional(),
  frequency: z.enum(RECURRENCE_FREQUENCIES),
  interval: z.coerce
    .number()
    .int()
    .min(1, "Repeat at least every 1.")
    .max(365, "That is too far apart."),
  /**
   * When it next runs. The rule is re-anchored from here, so "next due on the
   * 31st, monthly" means the 31st of every month from then on, which is what
   * someone changing this date is asking for.
   */
  nextRunOn: day,
  endDate: day.nullable().optional(),
};

export const updateRecurringRuleSchema = z
  .object({ ...ruleFields, id: uuid })
  .superRefine(checkShape);

/**
 * A new rule, made on the Recurring screen.
 *
 * The same fields as an edit without an id. `nextRunOn` is the first date
 * it runs; a rule starting today or earlier posts that occurrence straight
 * away rather than at tomorrow's daily catch-up.
 */
export const createRecurringRuleSchema = z
  .object(ruleFields)
  .superRefine(checkShape);

export const recurringRuleIdSchema = z.object({ id: uuid });

export const pauseRecurringRuleSchema = z.object({
  id: uuid,
  paused: z.boolean(),
});

export const skipOccurrenceSchema = z.object({ id: uuid, on: day });

export const payOccurrenceSchema = z.object({ id: uuid, on: day });

export const deleteRecurringRuleSchema = z.object({
  id: uuid,
  /** False, the default, leaves the records it already created in place. */
  deleteTransactions: z.boolean().default(false),
});

export type UpdateRecurringRuleInput = z.input<typeof updateRecurringRuleSchema>;
export type CreateRecurringRuleInput = z.input<typeof createRecurringRuleSchema>;
