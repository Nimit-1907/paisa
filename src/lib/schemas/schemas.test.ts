import { describe, expect, it } from "vitest";

import { budgetPercent, budgetTone, setBudgetSchema } from "@/lib/schemas/budgets";
import {
  exportRangeSchema,
  MAX_EXPORT_DAYS,
  rangeToInstants,
} from "@/lib/schemas/export";
import {
  changePasswordSchema,
  deleteAccountSchema,
  updateProfileSchema,
} from "@/lib/schemas/profile";
import { updateRecurringRuleSchema } from "@/lib/schemas/recurring";
import {
  createTransactionSchema,
  transactionFiltersSchema,
} from "@/lib/schemas/transactions";

/**
 * The schemas are the only thing between a Server Action and the database.
 *
 * Every one of these rules exists because the database enforces it too — a
 * constraint violation reaches the user as "new row violates check
 * constraint", which tells them nothing. These tests check that the readable
 * answer comes out instead, and that nothing gets through that the database
 * would then refuse.
 */

const uuid = (n: number) =>
  `0000000${n}-0000-4000-8000-00000000000${n}`.slice(0, 36);

const ACCOUNT = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const CATEGORY = "33333333-3333-4333-8333-333333333333";

const base = {
  type: "expense" as const,
  amount: "250",
  accountId: ACCOUNT,
  occurredAt: "2026-11-14T10:30",
};

describe("createTransactionSchema", () => {
  it("accepts an ordinary expense", () => {
    const result = createTransactionSchema.safeParse({
      ...base,
      categoryId: CATEGORY,
    });
    expect(result.success).toBe(true);
  });

  it("insists an expense has a category", () => {
    const result = createTransactionSchema.safeParse(base);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("Pick a category.");
  });

  it("insists a transfer has somewhere to go", () => {
    const result = createTransactionSchema.safeParse({
      ...base,
      type: "transfer",
    });
    expect(result.error?.issues[0]?.message).toBe(
      "Choose the account the money goes to.",
    );
  });

  it("refuses a transfer to the same account", () => {
    const result = createTransactionSchema.safeParse({
      ...base,
      type: "transfer",
      toAccountId: ACCOUNT,
    });
    expect(result.error?.issues[0]?.message).toBe(
      "A transfer needs two different accounts.",
    );
  });

  it("refuses a transfer that also carries a category", () => {
    const result = createTransactionSchema.safeParse({
      ...base,
      type: "transfer",
      toAccountId: OTHER,
      categoryId: CATEGORY,
    });
    expect(result.error?.issues[0]?.message).toContain("no category");
  });

  it("refuses an expense with a destination account", () => {
    const result = createTransactionSchema.safeParse({
      ...base,
      categoryId: CATEGORY,
      toAccountId: OTHER,
    });
    expect(result.error?.issues[0]?.message).toBe(
      "Only a transfer has a destination account.",
    );
  });

  it("refuses an empty amount and a non-uuid account", () => {
    expect(
      createTransactionSchema.safeParse({
        ...base,
        amount: "   ",
        categoryId: CATEGORY,
      }).success,
    ).toBe(false);

    expect(
      createTransactionSchema.safeParse({
        ...base,
        accountId: "not-an-id",
        categoryId: CATEGORY,
      }).success,
    ).toBe(false);
  });

  it("takes a repeat only in the shape the rule table accepts", () => {
    expect(
      createTransactionSchema.safeParse({
        ...base,
        categoryId: CATEGORY,
        repeat: { frequency: "monthly", interval: 1, endDate: null },
      }).success,
    ).toBe(true);

    expect(
      createTransactionSchema.safeParse({
        ...base,
        categoryId: CATEGORY,
        repeat: { frequency: "fortnightly", interval: 1 },
      }).success,
    ).toBe(false);

    expect(
      createTransactionSchema.safeParse({
        ...base,
        categoryId: CATEGORY,
        repeat: { frequency: "monthly", interval: 0 },
      }).success,
    ).toBe(false);
  });
});

describe("transactionFiltersSchema", () => {
  it("accepts what the filter sheet produces", () => {
    const result = transactionFiltersSchema.safeParse({
      search: "petrol",
      types: ["expense", "transfer"],
      accountIds: [ACCOUNT],
      from: "2026-11-01",
      to: "2026-11-30",
    });
    expect(result.success).toBe(true);
  });

  it("refuses a date that is not a date and a list that is not uuids", () => {
    expect(
      transactionFiltersSchema.safeParse({ from: "last tuesday" }).success,
    ).toBe(false);
    expect(
      transactionFiltersSchema.safeParse({ accountIds: ["'; drop table"] })
        .success,
    ).toBe(false);
  });

  it("caps the lists so a hand-made URL cannot ask for thousands", () => {
    const many = Array.from({ length: 60 }, (_, index) => uuid(index % 9));
    expect(transactionFiltersSchema.safeParse({ accountIds: many }).success).toBe(
      false,
    );
  });
});

describe("updateRecurringRuleSchema", () => {
  const rule = {
    id: ACCOUNT,
    type: "expense" as const,
    amount: "2200",
    accountId: ACCOUNT,
    categoryId: CATEGORY,
    frequency: "monthly" as const,
    interval: 1,
    nextRunOn: "2026-12-03",
  };

  it("accepts a rule the way the sheet sends it", () => {
    expect(updateRecurringRuleSchema.safeParse(rule).success).toBe(true);
  });

  it("holds a rule to the same shape a transaction has", () => {
    expect(
      updateRecurringRuleSchema.safeParse({ ...rule, categoryId: undefined })
        .success,
    ).toBe(false);
  });

  it("refuses an interval that is not a whole number in range", () => {
    for (const interval of [0, -1, 400, 1.5]) {
      expect(
        updateRecurringRuleSchema.safeParse({ ...rule, interval }).success,
      ).toBe(false);
    }
  });

  it("refuses a next-due date that is not a date", () => {
    expect(
      updateRecurringRuleSchema.safeParse({ ...rule, nextRunOn: "soon" })
        .success,
    ).toBe(false);
  });
});

describe("setBudgetSchema", () => {
  it("takes a yyyy-mm month and nothing looser", () => {
    expect(
      setBudgetSchema.safeParse({
        categoryId: CATEGORY,
        month: "2026-11",
        amount: "7000",
      }).success,
    ).toBe(true);

    for (const month of ["2026-11-01", "2026-13", "november", "2026-0"]) {
      expect(
        setBudgetSchema.safeParse({
          categoryId: CATEGORY,
          month,
          amount: "7000",
        }).success,
      ).toBe(false);
    }
  });

  it("defaults to not carrying the amount forward", () => {
    const result = setBudgetSchema.parse({
      categoryId: CATEGORY,
      month: "2026-11",
      amount: "7000",
    });
    expect(result.applyForward).toBe(false);
  });
});

describe("budget tone and percent", () => {
  it("turns green, amber and red at the right places", () => {
    expect(budgetTone(100n, 1000n)).toBe("under");
    // Exactly 80% is where the warning starts.
    expect(budgetTone(800n, 1000n)).toBe("close");
    expect(budgetTone(799n, 1000n)).toBe("under");
    // Spending the last rupee of a budget is not a failure.
    expect(budgetTone(1000n, 1000n)).toBe("close");
    expect(budgetTone(1001n, 1000n)).toBe("over");
  });

  it("works on amounts too large to be a safe integer", () => {
    const huge = 9_007_199_254_740_993n;
    expect(budgetTone(huge, huge * 2n)).toBe("under");
    expect(budgetPercent(huge, huge * 2n)).toBeCloseTo(50, 1);
  });

  it("has no opinion when there is no budget", () => {
    expect(budgetTone(500n, 0n)).toBe("under");
    expect(budgetPercent(500n, 0n)).toBe(0);
  });
});

describe("updateProfileSchema", () => {
  const profile = {
    displayName: "Nimit",
    currencyCode: "inr",
    weekStart: 1,
    theme: "system" as const,
  };

  it("upper-cases a currency code and accepts a known one", () => {
    const result = updateProfileSchema.parse(profile);
    expect(result.currencyCode).toBe("INR");
  });

  it("refuses a currency the app cannot format", () => {
    expect(
      updateProfileSchema.safeParse({ ...profile, currencyCode: "XYZ" }).success,
    ).toBe(false);
  });

  it("keeps week start inside a week", () => {
    expect(updateProfileSchema.safeParse({ ...profile, weekStart: 7 }).success).toBe(
      false,
    );
    expect(updateProfileSchema.safeParse({ ...profile, weekStart: 0 }).success).toBe(
      true,
    );
  });

  it("insists on a name", () => {
    expect(
      updateProfileSchema.safeParse({ ...profile, displayName: "  " }).success,
    ).toBe(false);
  });
});

describe("changePasswordSchema", () => {
  const passwords = {
    currentPassword: "password123",
    newPassword: "a-better-one",
    confirmPassword: "a-better-one",
  };

  it("accepts a sound change", () => {
    expect(changePasswordSchema.safeParse(passwords).success).toBe(true);
  });

  it("catches a typo in the repeat", () => {
    const result = changePasswordSchema.safeParse({
      ...passwords,
      confirmPassword: "a-better-two",
    });
    expect(result.error?.issues[0]?.message).toBe("Those passwords do not match.");
  });

  it("refuses a password that is too short, and one that is the old one", () => {
    expect(
      changePasswordSchema.safeParse({
        ...passwords,
        newPassword: "short",
        confirmPassword: "short",
      }).success,
    ).toBe(false);

    expect(
      changePasswordSchema.safeParse({
        currentPassword: "password123",
        newPassword: "password123",
        confirmPassword: "password123",
      }).error?.issues[0]?.message,
    ).toBe("That is the password you already have.");
  });
});

describe("deleteAccountSchema", () => {
  it("only accepts the word, in capitals", () => {
    expect(deleteAccountSchema.safeParse({ confirm: "DELETE" }).success).toBe(true);
    // Trimmed, because a phone keyboard adds a space after a word.
    expect(deleteAccountSchema.safeParse({ confirm: "DELETE " }).success).toBe(true);

    for (const wrong of ["delete", "Delete", "", "DELETE NOW", "yes"]) {
      expect(deleteAccountSchema.safeParse({ confirm: wrong }).success).toBe(false);
    }
  });
});

describe("exportRangeSchema", () => {
  it("accepts a sane range", () => {
    expect(
      exportRangeSchema.safeParse({ from: "2026-11-01", to: "2026-11-30" })
        .success,
    ).toBe(true);
    // One day is a range too.
    expect(
      exportRangeSchema.safeParse({ from: "2026-11-30", to: "2026-11-30" })
        .success,
    ).toBe(true);
  });

  it("refuses a backwards range and one that is too long", () => {
    expect(
      exportRangeSchema.safeParse({ from: "2026-11-30", to: "2026-11-01" })
        .error?.issues[0]?.message,
    ).toBe("The start is after the end.");

    expect(
      exportRangeSchema.safeParse({ from: "2010-01-01", to: "2026-11-01" })
        .error?.issues[0]?.message,
    ).toBe("Export at most three years at a time.");
  });

  it("allows exactly the documented maximum", () => {
    const from = new Date(Date.UTC(2026, 10, 14));
    const to = new Date(from.getTime() + MAX_EXPORT_DAYS * 86_400_000);

    expect(
      exportRangeSchema.safeParse({
        from: from.toISOString().slice(0, 10),
        to: to.toISOString().slice(0, 10),
      }).success,
    ).toBe(true);
  });
});

describe("rangeToInstants", () => {
  it("covers both ends of the range in the user's own timezone", () => {
    const range = rangeToInstants(
      { from: "2026-11-01", to: "2026-11-30" },
      "Asia/Kolkata",
    );

    // 1 November in Kolkata begins at 18:30 UTC on 31 October.
    expect(range?.startsAt).toBe("2026-10-31T18:30:00.000Z");
    // Exclusive, at the start of 1 December — so all of the 30th is inside.
    expect(range?.endsAt).toBe("2026-11-30T18:30:00.000Z");
  });

  it("crosses a month end without rolling the date over", () => {
    const range = rangeToInstants(
      { from: "2026-02-28", to: "2026-02-28" },
      "UTC",
    );

    expect(range?.startsAt).toBe("2026-02-28T00:00:00.000Z");
    expect(range?.endsAt).toBe("2026-03-01T00:00:00.000Z");
  });
});
