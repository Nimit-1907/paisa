import { describe, expect, it } from "vitest";

import { comparedWith, expenseThrough, leftLabel } from "./month-trend";

const oct = Array.from({ length: 31 }, (_, i) => ({
  on: `2026-10-${String(i + 1).padStart(2, "0")}`,
  expense: "100",
}));

describe("expenseThrough", () => {
  it("adds the previous month only up to the same day of the month", () => {
    expect(expenseThrough(oct, 17)).toBe(1700n);
  });

  it("takes the whole month when there is no cut-off", () => {
    expect(expenseThrough(oct, null)).toBe(3100n);
  });

  it("takes the whole of a shorter month when today is past its end", () => {
    const sept = oct
      .slice(0, 30)
      .map((d) => ({ ...d, on: d.on.replace("-10-", "-09-") }));
    expect(expenseThrough(sept, 31)).toBe(3000n);
  });

  it("is zero for an empty month", () => {
    expect(expenseThrough([], 17)).toBe(0n);
  });
});

describe("comparedWith", () => {
  it("names the same stretch of last month while this month is running", () => {
    expect(comparedWith(2026, 11, "2026-11-17")).toBe("1–17 Oct");
  });

  it("names last month alone on the first of the month", () => {
    expect(comparedWith(2026, 11, "2026-11-01")).toBe("1 Oct");
  });

  it("stops at the end of a shorter last month", () => {
    expect(comparedWith(2026, 10, "2026-10-31")).toBe("1–30 Sep");
  });

  it("names the whole month for a month that is over", () => {
    expect(comparedWith(2026, 10, "2026-11-17")).toBe("Sep");
  });

  it("goes back across a new year", () => {
    expect(comparedWith(2027, 1, "2027-01-05")).toBe("1–5 Dec");
  });
});

describe("leftLabel", () => {
  it("speaks of this month while it is running", () => {
    expect(leftLabel(false, null)).toBe("Left this month");
    expect(leftLabel(true, null)).toBe("Overspent this month");
  });

  it("names a month that is over", () => {
    expect(leftLabel(false, "Jul")).toBe("Left in Jul");
    expect(leftLabel(true, "Jul")).toBe("Overspent in Jul");
  });
});
