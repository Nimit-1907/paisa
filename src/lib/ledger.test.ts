import { describe, expect, it } from "vitest";

import { balancesAfter, railDate } from "./ledger";

describe("balancesAfter", () => {
  it("is the month's net after the newest day, and walks back from there", () => {
    // Newest first: today spent 2,643, yesterday 2,122, the 15th was a
    // transfer that nets to nothing, the 1st brought the salary in.
    const days = [
      { key: "2026-11-17", net: -2643n },
      { key: "2026-11-16", net: -2122n },
      { key: "2026-11-15", net: 0n },
      { key: "2026-11-01", net: 85000n },
    ];
    expect(balancesAfter(days, 45466n)).toEqual([
      45466n,
      48109n,
      50231n,
      50231n,
    ]);
  });

  it("is empty for no days", () => {
    expect(balancesAfter([], 100n)).toEqual([]);
  });

  it("can go below zero, an overspent stretch", () => {
    expect(
      balancesAfter(
        [
          { key: "a", net: -500n },
          { key: "b", net: -100n },
        ],
        -600n,
      ),
    ).toEqual([-600n, -100n]);
  });
});

describe("railDate", () => {
  it("is the day of the month and the short weekday", () => {
    expect(railDate("2026-11-17")).toEqual({ date: "17", weekday: "Tue" });
    expect(railDate("2026-11-01")).toEqual({ date: "1", weekday: "Sun" });
  });
});
