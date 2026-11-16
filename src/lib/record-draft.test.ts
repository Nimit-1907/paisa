import { describe, expect, it } from "vitest";

import type { TransactionRow } from "@/lib/queries/transactions";

import { logAgainDraft, withoutInactive } from "./record-draft";

const record = {
  id: "r1",
  type: "expense",
  amount: "45000",
  note: "Dinner at Barbeque Nation",
  occurredAt: "2026-10-03T14:30:00.000Z",
  accountId: "card",
  toAccountId: null,
  categoryId: "food",
  recurringRuleId: "rule-1",
} as TransactionRow;

describe("logAgainDraft", () => {
  it("copies what the record was", () => {
    const draft = logAgainDraft(record, "Asia/Kolkata", new Date());
    expect(draft).toMatchObject({
      type: "expense",
      amount: "45000",
      accountId: "card",
      toAccountId: null,
      categoryId: "food",
      note: "Dinner at Barbeque Nation",
    });
  });

  it("is dated now, in the profile's timezone, not on the original day", () => {
    const now = new Date("2026-11-17T04:45:00.000Z");
    expect(logAgainDraft(record, "Asia/Kolkata", now).occurredAtLocal).toBe(
      "2026-11-17T10:15",
    );
  });

  it("is not part of the record's recurring rule", () => {
    expect(
      logAgainDraft(record, "Asia/Kolkata", new Date()).recurringRuleId,
    ).toBeNull();
  });

  it("has no mode, so the sheet saves it as a new record", () => {
    expect(
      logAgainDraft(record, "Asia/Kolkata", new Date()),
    ).not.toHaveProperty("mode");
  });
});

describe("withoutInactive", () => {
  const draft = logAgainDraft(
    { ...record, type: "transfer", toAccountId: "wallet", categoryId: null },
    "Asia/Kolkata",
    new Date(),
  );

  it("keeps accounts and a category that are still open", () => {
    expect(
      withoutInactive(
        { ...draft, categoryId: "food" },
        { accountIds: ["card", "wallet"], categoryIds: ["food"] },
      ),
    ).toMatchObject({
      accountId: "card",
      toAccountId: "wallet",
      categoryId: "food",
    });
  });

  it("drops an archived account, To account or category", () => {
    expect(
      withoutInactive(
        { ...draft, categoryId: "old-cat" },
        { accountIds: ["bank"], categoryIds: ["food"] },
      ),
    ).toMatchObject({ accountId: "", toAccountId: null, categoryId: null });
  });
});
