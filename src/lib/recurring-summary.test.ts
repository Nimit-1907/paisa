import { describe, expect, it } from "vitest";

import { type SummaryRule, deductionTotals } from "./recurring-summary";

const rule = (overrides: Partial<SummaryRule>): SummaryRule => ({
  type: "expense",
  amount: "120000",
  frequency: "monthly",
  interval: 1,
  active: true,
  dueOn: "2026-12-01",
  ...overrides,
});

describe("deductionTotals", () => {
  it("puts a monthly rule on a yearly footing and cuts week and month from it", () => {
    // ₹1,200 a month: ₹14,400 a year, ₹1,200 a month, 14,400 × 7 / 365 a week.
    const totals = deductionTotals([rule({})]);
    expect(totals.yearly).toBe(1_440_000n);
    expect(totals.monthly).toBe(120_000n);
    expect(totals.weekly).toBe(27_616n);
    expect(totals.count).toBe(1);
  });

  it("counts a weekly rule 365/7 times a year, not 52", () => {
    // ₹70 a week is ₹3,650 a year.
    const totals = deductionTotals([
      rule({ amount: "7000", frequency: "weekly" }),
    ]);
    expect(totals.yearly).toBe(365_000n);
    expect(totals.weekly).toBe(7_000n);
  });

  it("divides by the interval", () => {
    const everyOther = deductionTotals([rule({ interval: 2 })]);
    expect(everyOther.yearly).toBe(720_000n);

    const daily = deductionTotals([
      rule({ amount: "1000", frequency: "daily", interval: 1 }),
    ]);
    expect(daily.yearly).toBe(365_000n);

    const yearly = deductionTotals([
      rule({ amount: "500000", frequency: "yearly" }),
    ]);
    expect(yearly.yearly).toBe(500_000n);
    expect(yearly.monthly).toBe(41_667n);
  });

  it("only counts expenses that will run again", () => {
    const totals = deductionTotals([
      rule({}),
      rule({ type: "income" }),
      rule({ type: "transfer" }),
      rule({ active: false }),
      rule({ dueOn: null }),
    ]);
    expect(totals.count).toBe(1);
    expect(totals.yearly).toBe(1_440_000n);
  });

  it("is zero with nothing to count", () => {
    expect(deductionTotals([])).toEqual({
      weekly: 0n,
      monthly: 0n,
      yearly: 0n,
      count: 0,
    });
  });
});
