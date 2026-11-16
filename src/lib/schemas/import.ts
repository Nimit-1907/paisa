import { z } from "zod";

import { NOTE_MAX } from "@/lib/import/rows";

/**
 * What Import sends the server.
 *
 * The browser read the file, but the action trusts none of it. Amounts
 * arrive as minor-unit digits (a BigInt does not survive the trip as one),
 * dates as calendar days in the person's timezone, and every row carries the
 * category the preview settled on. Whether that category and the account
 * are the caller's is for the action to check against the database.
 */

export const MAX_IMPORT_ROWS = 2000;

const uuid = z.string().uuid();

/** A real calendar day, so "2026-02-30" never reaches the database. */
const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "A date is not in the right shape.")
  .refine((value) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [year, month, date] = value.split("-").map(Number);
    const parsed = new Date(Date.UTC(year, month - 1, date));
    return (
      parsed.getUTCFullYear() === year &&
      parsed.getUTCMonth() === month - 1 &&
      parsed.getUTCDate() === date
    );
  }, "A date does not exist.");

const minorUnits = z
  .string()
  .regex(/^\d{1,16}$/, "An amount is not in the right shape.")
  .refine((value) => {
    // Refinements still run after a failed regex, and BigInt("4.50") throws.
    if (!/^\d{1,16}$/.test(value)) return false;
    const minor = BigInt(value);
    return minor > 0n && minor <= BigInt(Number.MAX_SAFE_INTEGER);
  }, "An amount has to be more than zero.");

export const importRowSchema = z.object({
  type: z.enum(["expense", "income"]),
  amount: minorUnits,
  date: day,
  note: z
    .string()
    .trim()
    .max(NOTE_MAX, "A note is longer than 500 characters.")
    .nullable(),
  // Null only on a row the preview found a duplicate: the action refuses
  // one it would insert without a category.
  categoryId: uuid.nullable(),
});

export const importRecordsSchema = z.object({
  accountId: uuid,
  rows: z
    .array(importRowSchema)
    .min(1, "There is nothing to import.")
    .max(MAX_IMPORT_ROWS, "Import at most 2,000 rows at a time."),
});

export type ImportRecordsInput = z.input<typeof importRecordsSchema>;

/** The preview's question: what does this account already have, and when. */
export const existingRecordsSchema = z
  .object({ accountId: uuid, from: day, to: day })
  .refine((value) => value.from <= value.to, {
    path: ["to"],
    message: "The start is after the end.",
  });

export type ExistingRecordsInput = z.input<typeof existingRecordsSchema>;
