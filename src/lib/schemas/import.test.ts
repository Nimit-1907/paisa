import { describe, expect, it } from "vitest";

import {
  existingRecordsSchema,
  importRecordsSchema,
  MAX_IMPORT_ROWS,
} from "@/lib/schemas/import";

/**
 * What Import may send the server.
 *
 * The preview has already read the file, but the action trusts none of it:
 * the amounts arrive as minor-unit digits, the dates as calendar days, and
 * every row needs a category before anything is written.
 */

const ACCOUNT = "11111111-1111-4111-8111-111111111111";
const FOOD = "22222222-2222-4222-8222-222222222222";

const row = {
  type: "expense" as const,
  amount: "45050",
  date: "2026-11-01",
  note: "Swiggy",
  categoryId: FOOD,
};

const valid = { accountId: ACCOUNT, rows: [row] };

describe("importRecordsSchema", () => {
  it("accepts a well-formed import", () => {
    expect(importRecordsSchema.safeParse(valid).success).toBe(true);
    expect(
      importRecordsSchema.safeParse({ ...valid, rows: [{ ...row, note: null }] })
        .success,
    ).toBe(true);
  });

  it("caps an import at 2000 rows and needs one", () => {
    expect(MAX_IMPORT_ROWS).toBe(2000);
    expect(
      importRecordsSchema.safeParse({ ...valid, rows: Array(2000).fill(row) })
        .success,
    ).toBe(true);
    expect(
      importRecordsSchema.safeParse({ ...valid, rows: Array(2001).fill(row) })
        .success,
    ).toBe(false);
    expect(importRecordsSchema.safeParse({ ...valid, rows: [] }).success).toBe(
      false,
    );
  });

  it("refuses an amount that is not more than zero or not whole minor units", () => {
    for (const amount of ["0", "-5", "4.50", "", "1e5", "9007199254740992"]) {
      expect(
        importRecordsSchema.safeParse({ ...valid, rows: [{ ...row, amount }] })
          .success,
        amount,
      ).toBe(false);
    }
  });

  it("refuses a note over 500 characters", () => {
    expect(
      importRecordsSchema.safeParse({
        ...valid,
        rows: [{ ...row, note: "x".repeat(501) }],
      }).success,
    ).toBe(false);
  });

  it("refuses a date that does not exist", () => {
    for (const date of ["2026-02-30", "2026-13-01", "01/11/2026"]) {
      expect(
        importRecordsSchema.safeParse({ ...valid, rows: [{ ...row, date }] })
          .success,
        date,
      ).toBe(false);
    }
  });

  it("lets a row arrive without a category, for the server to find a duplicate", () => {
    // The preview sends every row, duplicates included, because only the
    // server's count decides which rows an existing record cancels. A row
    // that would be inserted without a category is refused by the action.
    expect(
      importRecordsSchema.safeParse({
        ...valid,
        rows: [{ ...row, categoryId: null }],
      }).success,
    ).toBe(true);
  });

  it("refuses a transfer and a bad account", () => {
    expect(
      importRecordsSchema.safeParse({
        ...valid,
        rows: [{ ...row, type: "transfer" }],
      }).success,
    ).toBe(false);
    expect(
      importRecordsSchema.safeParse({ ...valid, accountId: "nope" }).success,
    ).toBe(false);
  });
});

describe("existingRecordsSchema", () => {
  it("takes an account and an ordered range of days", () => {
    expect(
      existingRecordsSchema.safeParse({
        accountId: ACCOUNT,
        from: "2026-01-01",
        to: "2026-11-30",
      }).success,
    ).toBe(true);
    expect(
      existingRecordsSchema.safeParse({
        accountId: ACCOUNT,
        from: "2026-12-01",
        to: "2026-11-30",
      }).success,
    ).toBe(false);
  });
});
