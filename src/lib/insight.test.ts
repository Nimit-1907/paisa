import { describe, expect, it } from "vitest";

import { describeInsight } from "@/lib/insight";

/**
 * The sentence is the first thing read on Analysis, and a wrong one is worse
 * than none: "18% higher" when it was lower teaches the reader to stop
 * believing the screen.
 */
describe("describeInsight", () => {
  const base = {
    kind: "expense" as const,
    periodKind: "month" as const,
    total: 100_000n,
  };

  it("says nothing when there is nothing to say", () => {
    expect(describeInsight({ ...base, top: null, topPrevious: null })).toBeNull();
    expect(
      describeInsight({
        ...base,
        top: { name: "Food", total: 0n },
        topPrevious: null,
      }),
    ).toBeNull();
  });

  it("compares with the period before when there is one", () => {
    expect(
      describeInsight({
        ...base,
        top: { name: "Food", total: 11_800n },
        topPrevious: 10_000n,
      }),
    ).toBe("Food is your biggest expense this month, 18% higher than last month.");

    expect(
      describeInsight({
        ...base,
        top: { name: "Food", total: 8_000n },
        topPrevious: 10_000n,
      }),
    ).toBe("Food is your biggest expense this month, 20% lower than last month.");
  });

  it("does not report noise as news", () => {
    expect(
      describeInsight({
        ...base,
        top: { name: "Food", total: 10_200n },
        topPrevious: 10_000n,
      }),
    ).toBe("Food is your biggest expense this month, about the same as last month.");
  });

  it("falls back to a share when there is nothing to compare with", () => {
    expect(
      describeInsight({
        ...base,
        top: { name: "Rent", total: 60_000n },
        topPrevious: null,
      }),
    ).toBe("Rent is your biggest expense this month, 60% of the total.");

    // A previous period of zero is not a comparison either.
    expect(
      describeInsight({
        ...base,
        top: { name: "Rent", total: 60_000n },
        topPrevious: 0n,
      }),
    ).toBe("Rent is your biggest expense this month, 60% of the total.");
  });

  it("uses the right words for each period and for income", () => {
    expect(
      describeInsight({
        ...base,
        periodKind: "week",
        top: { name: "Food", total: 50_000n },
        topPrevious: null,
      }),
    ).toContain("this week");

    expect(
      describeInsight({
        ...base,
        periodKind: "custom",
        top: { name: "Food", total: 50_000n },
        topPrevious: 40_000n,
      }),
    ).toContain("the period before");

    expect(
      describeInsight({
        ...base,
        kind: "income",
        top: { name: "Salary", total: 90_000n },
        topPrevious: null,
      }),
    ).toBe("Salary is your source of income this month, 90% of the total.");
  });

  it("works on amounts too large to be a safe integer", () => {
    const huge = 9_007_199_254_740_993n;
    expect(
      describeInsight({
        kind: "expense",
        periodKind: "month",
        total: huge * 2n,
        top: { name: "Rent", total: huge },
        topPrevious: huge / 2n,
      }),
    ).toBe("Rent is your biggest expense this month, 100% higher than last month.");
  });
});
