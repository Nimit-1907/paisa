import { describe, expect, it } from "vitest";

import { duplicateKey, markDuplicates } from "@/lib/import/duplicates";

/**
 * Re-uploading a statement must never book anything twice.
 *
 * A row is a duplicate when the account already has a record of the same
 * type, amount and local date, or when an earlier row of the same file is
 * identical to it (same type, amount, date and note).
 */

const row = (
  type: "expense" | "income",
  amount: bigint,
  date: string,
  note: string | null = null,
) => ({ type, amount, date, note });

describe("markDuplicates", () => {
  it("passes rows with nothing like them", () => {
    expect(
      markDuplicates([row("expense", 100n, "2026-11-01")], new Set()),
    ).toEqual([null]);
  });

  it("marks a row the account already has", () => {
    const existing = new Set([duplicateKey("expense", 100n, "2026-11-01")]);

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
    ).toEqual(["existing", null, null, null]);
  });

  it("marks the second of two identical rows in the file", () => {
    expect(
      markDuplicates(
        [
          row("expense", 100n, "2026-11-01", "Tea"),
          row("expense", 100n, "2026-11-01", "Tea"),
          row("expense", 100n, "2026-11-01", "Coffee"),
          row("expense", 100n, "2026-11-01", " tea "),
        ],
        new Set(),
      ),
    ).toEqual([null, "file", null, "file"]);
  });

  it("calls a row the account already has existing, even when repeated", () => {
    const existing = new Set([duplicateKey("income", 5n, "2026-01-01")]);

    expect(
      markDuplicates(
        [row("income", 5n, "2026-01-01"), row("income", 5n, "2026-01-01")],
        existing,
      ),
    ).toEqual(["existing", "existing"]);
  });
});
