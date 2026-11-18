import { describe, expect, it } from "vitest";

import { formatCompact } from "@/lib/money";
import {
  bucketFor,
  comparablePeriod,
  shortRange,
  bucketIsPartial,
  bucketLabel,
  bucketTitle,
  parsePeriod,
  type Period,
  periodContaining,
  periodLabel,
  periodLength,
  previousPeriod,
  shiftPeriod,
} from "@/lib/period";

/**
 * The window Analysis looks at, and the short numbers on its axes.
 *
 * Both are pure, and both are the kind of thing that is wrong by one for
 * months before anyone notices, a week that starts on the wrong day, a
 * "previous period" that is a different length from the one it is compared
 * with, an axis that says ₹1.2K when it means ₹12K.
 */

describe("periodContaining", () => {
  it("builds a Monday-start week around a date", () => {
    // 2026-11-14 is a Saturday.
    expect(periodContaining("week", "2026-11-14", 1)).toEqual({
      kind: "week",
      from: "2026-11-09",
      to: "2026-11-15",
    });
  });

  it("builds a Sunday-start week for the users who read it that way", () => {
    expect(periodContaining("week", "2026-11-14", 0)).toEqual({
      kind: "week",
      from: "2026-11-08",
      to: "2026-11-14",
    });
  });

  it("treats the first day of a week as its own start", () => {
    expect(periodContaining("week", "2026-11-09", 1).from).toBe("2026-11-09");
  });

  it("covers a whole month, including a short February", () => {
    expect(periodContaining("month", "2026-02-14")).toEqual({
      kind: "month",
      from: "2026-02-01",
      to: "2026-02-28",
    });
    expect(periodContaining("month", "2024-02-14").to).toBe("2024-02-29");
  });

  it("covers a whole year", () => {
    expect(periodContaining("year", "2026-07-04")).toEqual({
      kind: "year",
      from: "2026-01-01",
      to: "2026-12-31",
    });
  });
});

describe("shiftPeriod", () => {
  const week: Period = { kind: "week", from: "2026-11-09", to: "2026-11-15" };
  const month: Period = { kind: "month", from: "2026-01-01", to: "2026-01-31" };
  const custom: Period = {
    kind: "custom",
    from: "2026-11-10",
    to: "2026-11-24",
  };

  it("steps a week by seven days", () => {
    expect(shiftPeriod(week, 1)).toEqual({
      kind: "week",
      from: "2026-11-16",
      to: "2026-11-22",
    });
    expect(shiftPeriod(week, -1).from).toBe("2026-11-02");
  });

  it("steps a month to the whole next month, not 31 days", () => {
    expect(shiftPeriod(month, 1)).toEqual({
      kind: "month",
      from: "2026-02-01",
      to: "2026-02-28",
    });
  });

  it("steps a month backwards across a year boundary", () => {
    expect(shiftPeriod(month, -1)).toEqual({
      kind: "month",
      from: "2025-12-01",
      to: "2025-12-31",
    });
  });

  it("steps a year", () => {
    expect(
      shiftPeriod({ kind: "year", from: "2026-01-01", to: "2026-12-31" }, -2),
    ).toEqual({ kind: "year", from: "2024-01-01", to: "2024-12-31" });
  });

  it("steps a custom range by its own length", () => {
    expect(shiftPeriod(custom, -1)).toEqual({
      kind: "custom",
      from: "2026-10-26",
      to: "2026-11-09",
    });
  });

  it("keeps the comparison honest: the previous period is the same length", () => {
    for (const period of [week, month, custom]) {
      const before = previousPeriod(period);
      if (period.kind === "month") {
        // Calendar months differ in length on purpose, January against
        // December, not January against "the last 31 days".
        expect(before.kind).toBe("month");
      } else {
        expect(periodLength(before)).toBe(periodLength(period));
      }
    }
  });
});

describe("bucketFor", () => {
  it("uses days for a week and a month, months for a year", () => {
    expect(
      bucketFor({ kind: "week", from: "2026-11-09", to: "2026-11-15" }),
    ).toBe("day");
    expect(
      bucketFor({ kind: "month", from: "2026-11-01", to: "2026-11-30" }),
    ).toBe("day");
    expect(
      bucketFor({ kind: "year", from: "2026-01-01", to: "2026-12-31" }),
    ).toBe("month");
  });

  it("switches a custom range to months once days stop being legible", () => {
    expect(
      bucketFor({ kind: "custom", from: "2026-01-01", to: "2026-03-01" }),
    ).toBe("day");
    expect(
      bucketFor({ kind: "custom", from: "2026-01-01", to: "2026-09-01" }),
    ).toBe("month");
  });
});

describe("parsePeriod", () => {
  const today = "2026-11-14";

  it("falls back to the month containing today", () => {
    expect(parsePeriod({}, today)).toEqual({
      kind: "month",
      from: "2026-11-01",
      to: "2026-11-30",
    });
  });

  it("reads a kind and an anchor", () => {
    expect(parsePeriod({ p: "week", d: "2026-11-14" }, today, 1).from).toBe(
      "2026-11-09",
    );
  });

  it("reads a custom range", () => {
    expect(
      parsePeriod({ p: "custom", from: "2026-11-01", to: "2026-11-10" }, today),
    ).toEqual({ kind: "custom", from: "2026-11-01", to: "2026-11-10" });
  });

  it("refuses a custom range that is backwards, broken or centuries long", () => {
    const fallback = { kind: "month", from: "2026-11-01", to: "2026-11-30" };

    expect(
      parsePeriod({ p: "custom", from: "2026-11-10", to: "2026-11-01" }, today),
    ).toEqual(fallback);
    expect(
      parsePeriod({ p: "custom", from: "nope", to: "2026-11-01" }, today),
    ).toEqual(fallback);
    expect(
      parsePeriod({ p: "custom", from: "1900-01-01", to: "2026-11-01" }, today),
    ).toEqual(fallback);
  });

  it("refuses a date that does not exist", () => {
    const fallback = { kind: "month", from: "2026-11-01", to: "2026-11-30" };

    expect(parsePeriod({ p: "month", d: "2026-13-45" }, today)).toEqual(
      fallback,
    );
    expect(parsePeriod({ p: "month", d: "2026-02-30" }, today)).toEqual(
      fallback,
    );
    expect(parsePeriod({ p: "week", d: "2026-00-10" }, today).kind).toBe(
      "week",
    );
    expect(
      parsePeriod({ p: "custom", from: "2026-02-30", to: "2026-03-05" }, today),
    ).toEqual(fallback);
  });

  it("refuses a kind it does not know", () => {
    expect(parsePeriod({ p: "fortnight" }, today).kind).toBe("month");
  });

  it("clamps a period that has not started yet", () => {
    expect(parsePeriod({ p: "month", d: "2027-06-01" }, today).from).toBe(
      "2026-11-01",
    );
  });

  it("keeps a past period alone", () => {
    expect(parsePeriod({ p: "month", d: "2026-03-14" }, today).from).toBe(
      "2026-03-01",
    );
  });
});

describe("labels", () => {
  it("names each kind the way the header reads it", () => {
    expect(
      periodLabel({ kind: "month", from: "2026-11-01", to: "2026-11-30" }),
    ).toBe("November 2026");
    expect(
      periodLabel({ kind: "year", from: "2026-01-01", to: "2026-12-31" }),
    ).toBe("2026");
    expect(
      periodLabel({ kind: "week", from: "2026-11-09", to: "2026-11-15" }),
    ).toBe("9 – 15 Nov 2026");
    expect(
      periodLabel({ kind: "custom", from: "2026-11-10", to: "2026-12-03" }),
    ).toBe("10 Nov – 3 Dec 2026");
    expect(
      periodLabel({ kind: "custom", from: "2025-12-28", to: "2026-01-04" }),
    ).toBe("28 Dec 2025 – 4 Jan 2026");
  });

  it("knows which month buckets a custom range only half covers", () => {
    const range: Period = {
      kind: "custom",
      from: "2026-10-15",
      to: "2027-01-31",
    };

    expect(bucketIsPartial(range, "2026-10-01", "month")).toBe(true);
    expect(bucketIsPartial(range, "2026-11-01", "month")).toBe(false);
    expect(bucketIsPartial(range, "2027-01-01", "month")).toBe(false);
    // Days are never partial, a day is either in the range or it is not.
    expect(bucketIsPartial(range, "2026-10-15", "day")).toBe(false);

    const cut: Period = {
      kind: "custom",
      from: "2026-10-01",
      to: "2027-01-20",
    };
    expect(bucketIsPartial(cut, "2026-10-01", "month")).toBe(false);
    expect(bucketIsPartial(cut, "2027-01-01", "month")).toBe(true);
  });

  it("labels buckets short on the axis and long in the tooltip", () => {
    expect(bucketLabel("2026-11-14", "day")).toBe("14");
    expect(bucketLabel("2026-11-01", "month")).toBe("Nov");
    expect(bucketTitle("2026-11-14", "day")).toBe("Sat 14 Nov");
    expect(bucketTitle("2026-11-01", "month")).toBe("November 2026");
  });
});

describe("formatCompact", () => {
  it("abbreviates the Indian way for ₹", () => {
    expect(formatCompact(50000n)).toBe("₹500");
    expect(formatCompact(120000n)).toBe("₹1.2K");
    expect(formatCompact(1200000n)).toBe("₹12K");
    expect(formatCompact(34000000n)).toBe("₹3.4L");
    expect(formatCompact(1100000000n)).toBe("₹1.1Cr");
    expect(formatCompact(11000000000n)).toBe("₹11Cr");
  });

  it("abbreviates the western way for other symbols", () => {
    expect(formatCompact(120000n, { symbol: "$" })).toBe("$1.2K");
    expect(formatCompact(340000000n, { symbol: "$" })).toBe("$3.4M");
    expect(formatCompact(110000000000n, { symbol: "$" })).toBe("$1.1B");
  });

  it("drops a trailing .0 rather than printing 1.0K", () => {
    expect(formatCompact(100000n)).toBe("₹1K");
    expect(formatCompact(10000000n)).toBe("₹1L");
  });

  it("keeps the sign and groups what is too small to abbreviate", () => {
    expect(formatCompact(-120000n)).toBe("-₹1.2K");
    expect(formatCompact(12345n)).toBe("₹123");
    expect(formatCompact(0n)).toBe("₹0");
    // Rounds to nothing, so it is nothing, not "-₹0".
    expect(formatCompact(-50n)).toBe("₹0");
  });

  it("respects a currency with no decimal places", () => {
    expect(formatCompact(1200n, { symbol: "¥", decimals: 0 })).toBe("¥1.2K");
  });
});

describe("comparablePeriod", () => {
  const november = {
    kind: "month" as const,
    from: "2026-11-01",
    to: "2026-11-30",
  };

  it("cuts last month to the days that have passed of this one", () => {
    expect(comparablePeriod(november, "2026-11-18")).toEqual({
      kind: "custom",
      from: "2026-10-01",
      to: "2026-10-18",
    });
  });

  it("never runs past the end of a shorter month", () => {
    const march = {
      kind: "month" as const,
      from: "2026-03-01",
      to: "2026-03-31",
    };
    expect(comparablePeriod(march, "2026-03-31").to).toBe("2026-02-28");
  });

  it("compares a finished period with the whole one before", () => {
    expect(comparablePeriod(november, "2026-12-05")).toEqual({
      kind: "month",
      from: "2026-10-01",
      to: "2026-10-31",
    });
  });
});

describe("shortRange", () => {
  it("names a window briefly", () => {
    expect(
      shortRange({ kind: "custom", from: "2026-10-01", to: "2026-10-18" }),
    ).toBe("1–18 Oct");
    expect(
      shortRange({ kind: "custom", from: "2026-10-01", to: "2026-10-01" }),
    ).toBe("1 Oct");
    expect(
      shortRange({ kind: "month", from: "2026-10-01", to: "2026-10-31" }),
    ).toBe("Oct");
    expect(
      shortRange({ kind: "week", from: "2026-09-28", to: "2026-10-04" }),
    ).toBe("28 Sep–4 Oct");
    expect(
      shortRange({ kind: "custom", from: "2025-01-01", to: "2025-11-18" }),
    ).toBe("1 Jan–18 Nov 2025");
  });
});
