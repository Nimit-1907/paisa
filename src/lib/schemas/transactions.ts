import { z } from "zod";

/**
 * The shape rules, mirrored from the database.
 *
 * transactions_shape_check already refuses a transfer with no destination or
 * an expense with no category — but a constraint violation reaches the user
 * as "new row violates check constraint". Checking the same rules here is
 * what turns that into a sentence. The database stays the authority.
 */

const uuid = z.string().uuid();

export const TRANSACTION_TYPES = ["expense", "income", "transfer"] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

export const RECURRENCE_FREQUENCIES = [
  "daily",
  "weekly",
  "monthly",
  "yearly",
] as const;
export type RecurrenceFrequency = (typeof RECURRENCE_FREQUENCIES)[number];

export const REPEAT_LABELS: Record<RecurrenceFrequency | "none", string> = {
  none: "Does not repeat",
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  yearly: "Yearly",
};

export const repeatSchema = z.object({
  frequency: z.enum(RECURRENCE_FREQUENCIES),
  interval: z
    .number()
    .int()
    .min(1, "Repeat at least every 1.")
    .max(365, "That is too far apart."),
  /** yyyy-mm-dd, or null for "no end". */
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2026-12-31")
    .nullable()
    .optional(),
});

const transactionFields = {
  type: z.enum(TRANSACTION_TYPES),
  /** What the keypad produced — parsed with the user's decimal places. */
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
  /** ISO instant. */
  occurredAt: z.string().min(1, "Pick a date."),
};

/** The rules transactions_shape_check enforces, with readable messages. */
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

export const createTransactionSchema = z
  .object({ ...transactionFields, repeat: repeatSchema.nullable().optional() })
  .superRefine(checkShape);

export const updateTransactionSchema = z
  .object({ ...transactionFields, id: uuid })
  .superRefine(checkShape);

export const transactionIdSchema = z.object({ id: uuid });

/** Re-inserting a deleted row, id and all, so undo restores exactly it. */
export const restoreTransactionSchema = z
  .object({
    ...transactionFields,
    id: uuid,
    recurringRuleId: uuid.nullable().optional(),
  })
  .superRefine(checkShape);

export type CreateTransactionInput = z.input<typeof createTransactionSchema>;
export type UpdateTransactionInput = z.input<typeof updateTransactionSchema>;
export type RestoreTransactionInput = z.input<typeof restoreTransactionSchema>;
export type RepeatInput = z.input<typeof repeatSchema>;

/* ------------------------------------------------------------- filters --- */

export const transactionFiltersSchema = z.object({
  /** Trigram search over the note. */
  search: z.string().trim().max(100).optional(),
  types: z.array(z.enum(TRANSACTION_TYPES)).optional(),
  accountIds: z.array(uuid).max(50).optional(),
  categoryIds: z.array(uuid).max(100).optional(),
  /** Decimal text, parsed with the user's decimal places. */
  minAmount: z.string().trim().max(20).optional(),
  maxAmount: z.string().trim().max(20).optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export type TransactionFilters = z.infer<typeof transactionFiltersSchema>;

/** The URL parameters the filter sheet owns, for clearing them in one go. */
export const FILTER_PARAM_KEYS = [
  "q",
  "type",
  "account",
  "category",
  "min",
  "max",
  "from",
  "to",
] as const;
