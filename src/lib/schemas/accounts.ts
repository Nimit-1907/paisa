import { z } from "zod";

import { ICON_NAMES } from "@/lib/icons";
import { TINT_KEYS } from "@/lib/tokens";

export const ACCOUNT_TYPES = [
  "cash",
  "bank",
  "card",
  "savings",
  "wallet",
  "other",
] as const;

export const ACCOUNT_TYPE_LABELS: Record<
  (typeof ACCOUNT_TYPES)[number],
  string
> = {
  cash: "Cash",
  bank: "Bank",
  card: "Card",
  savings: "Savings",
  wallet: "Wallet",
  other: "Other",
};

const name = z
  .string()
  .trim()
  .min(1, "Give the account a name.")
  .max(60, "That name is a bit long.");

const icon = z
  .string()
  .refine((value) => (ICON_NAMES as string[]).includes(value), "Pick an icon.");

/**
 * One of the eight, not a hex.
 *
 * Phase 14 replaced the free colour picker: every tint is checked against
 * AA on both themes in `src/lib/tokens.test.ts`, and a hex from a form
 * could not be.
 */
const tint = z.enum(TINT_KEYS);

export const accountFormSchema = z.object({
  name,
  type: z.enum(ACCOUNT_TYPES),
  icon,
  tint,
  // Text until the server knows the currency's exponent; toMinor does the rest.
  initialBalance: z.string().trim().max(20, "That is a very large number."),
  includeInTotal: z.boolean(),
});

export const createAccountSchema = accountFormSchema;

export const updateAccountSchema = accountFormSchema.extend({
  id: z.string().uuid(),
});

export const accountIdSchema = z.object({ id: z.string().uuid() });

export const archiveAccountSchema = z.object({
  id: z.string().uuid(),
  archived: z.boolean(),
});

export const reorderSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(200),
});

export type AccountFormInput = z.input<typeof accountFormSchema>;
export type UpdateAccountInput = z.input<typeof updateAccountSchema>;
export type AccountType = (typeof ACCOUNT_TYPES)[number];
