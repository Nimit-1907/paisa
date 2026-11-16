import { describe, expect, it } from "vitest";

import { groupByMonth } from "./search-groups";
import type { TransactionRow } from "@/lib/queries/transactions";

function row(
  overrides: Partial<TransactionRow> & Pick<TransactionRow, "occurredAt">,
): TransactionRow {
  return {
    id: overrides.occurredAt,
    type: "expense",
    amount: "10000",
    note: null,
    accountId: "a",
    accountName: "Cash",
    toAccountId: null,
    toAccountName: null,
    categoryId: null,
    categoryName: null,
    categoryIcon: null,
    categoryTint: null,
    recurringRuleId: null,
    recurringFrequency: null,
    ...overrides,
  };
}

const IST = "Asia/Kolkata";

describe("groupByMonth", () => {
  it("keeps the order the rows arrived in", () => {
    const groups = groupByMonth(
      [
        row({ occurredAt: "2026-11-03T06:00:00Z" }),
        row({ occurredAt: "2026-10-03T06:00:00Z" }),
        row({ occurredAt: "2026-11-01T06:00:00Z" }),
      ],
      IST,
    );

    expect(groups.map((group) => group.key)).toEqual(["2026-11", "2026-10"]);
    expect(groups[0]!.rows).toHaveLength(2);
    expect(groups[0]!.label).toBe("November 2026");
  });

  it("puts a record in the month the user was living in, not UTC's", () => {
    // 19:00 UTC on 31 October is 00:30 on 1 November in Kolkata.
    const groups = groupByMonth(
      [row({ occurredAt: "2026-10-31T19:00:00Z" })],
      IST,
    );

    expect(groups[0]!.key).toBe("2026-11");
  });

  it("nets income against expense", () => {
    const groups = groupByMonth(
      [
        row({
          occurredAt: "2026-11-03T06:00:00Z",
          type: "income",
          amount: "500000",
        }),
        row({
          occurredAt: "2026-11-02T06:00:00Z",
          type: "expense",
          amount: "120000",
        }),
      ],
      IST,
    );

    expect(groups[0]!.net).toBe(380000n);
  });

  it("leaves a transfer out of the net", () => {
    const groups = groupByMonth(
      [
        row({
          occurredAt: "2026-11-03T06:00:00Z",
          type: "transfer",
          amount: "900000",
        }),
        row({
          occurredAt: "2026-11-02T06:00:00Z",
          type: "expense",
          amount: "100000",
        }),
      ],
      IST,
    );

    expect(groups[0]!.net).toBe(-100000n);
    expect(groups[0]!.rows).toHaveLength(2);
  });

  it("has nothing to group when nothing matched", () => {
    expect(groupByMonth([], IST)).toEqual([]);
  });
});
