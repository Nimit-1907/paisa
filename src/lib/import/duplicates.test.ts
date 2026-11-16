import { describe, expect, it } from "vitest";

import { countKeys, duplicateKey, markDuplicates } from "@/lib/import/duplicates";

/**
 * Re-uploading a statement must never book anything twice, and two real
 * purchases must never be mistaken for one.
 *
 * Matching is a count: each record the account already has, of the same
 * type, amount and local date, cancels exactly one row of the file. Two
 * identical rows in one file are two records (two ₹50 coffees on one day).
 */

const row = (
  type: "expense" | "income",
  amount: bigint,
  date: string,
  note: string | null = null,
) => ({ type, amount, date, note });

describe("countKeys", () => {
  it("counts each key as often as it appears", () => {
    expect(countKeys(["a", "b", "a"])).toEqual(
      new Map([
        ["a", 2],
        ["b", 1],
      ]),
    );
  });
});

describe("markDuplicates", () => {
  it("passes rows with nothing like them", () => {
    expect(markDuplicates([row("expense", 100n, "2026-11-01")], new Map())).toEqual([
      false,
    ]);
  });

  it("marks a row the account already has, by type, amount and date", () => {
    const existing = countKeys([duplicateKey("expense", 100n, "2026-11-01")]);

    expect(
      markDuplicates(
        [
          row("expense", 100n, "2026-11-01", "Tea"),
          row("income", 100n, "2026-11-01"),
          row("expense", 100n, "2026-11-02"),
          row("expense", 101n, "2026-11-01"),
        ],
        existing,
      ),
    ).toEqual([true, false, false, false]);
  });

  it("keeps two identical rows of one file as two records", () => {
    expect(
      markDuplicates(
        [
          row("expense", 5000n, "2026-11-01", "Coffee"),
          row("expense", 5000n, "2026-11-01", "Coffee"),
        ],
        new Map(),
      ),
    ).toEqual([false, false]);
  });

  it("lets each existing record cancel exactly one row", () => {
    const coffee = row("expense", 5000n, "2026-11-01", "Coffee");
    const one = countKeys([duplicateKey("expense", 5000n, "2026-11-01")]);
    const two = countKeys([
      duplicateKey("expense", 5000n, "2026-11-01"),
      duplicateKey("expense", 5000n, "2026-11-01"),
    ]);

    expect(markDuplicates([coffee, coffee], one)).toEqual([true, false]);
    // The same file again, once both are in: nothing new.
    expect(markDuplicates([coffee, coffee], two)).toEqual([true, true]);
  });

  it("does not use up the counts it was given", () => {
    const existing = countKeys([duplicateKey("income", 5n, "2026-01-01")]);
    markDuplicates([row("income", 5n, "2026-01-01")], existing);

    expect(existing.get(duplicateKey("income", 5n, "2026-01-01"))).toBe(1);
  });
});
