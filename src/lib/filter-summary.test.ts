import { describe, expect, it } from "vitest";

import { countFilters, dateChip } from "./filter-summary";

describe("dateChip", () => {
  it("is one chip for one day", () => {
    expect(dateChip("2026-11-16", "2026-11-16")).toEqual({
      keys: ["from", "to"],
      label: "on 16 Nov",
    });
  });

  it("is one chip for a range in one month", () => {
    expect(dateChip("2026-11-16", "2026-11-18")?.label).toBe("16–18 Nov");
  });

  it("names both months for a range across two", () => {
    expect(dateChip("2026-10-28", "2026-11-03")?.label).toBe("28 Oct–3 Nov");
  });

  it("keeps an open start or end as from or to", () => {
    expect(dateChip("2026-11-16", undefined)).toEqual({ keys: ["from"], label: "from 16 Nov" });
    expect(dateChip(undefined, "2026-11-16")).toEqual({ keys: ["to"], label: "to 16 Nov" });
  });

  it("is nothing with no dates", () => {
    expect(dateChip(undefined, undefined)).toBeNull();
  });
});

describe("countFilters", () => {
  it("counts a date range as one filter", () => {
    expect(countFilters({ from: "2026-11-16", to: "2026-11-16" })).toBe(1);
  });

  it("counts every other set filter once and ignores empty lists", () => {
    expect(
      countFilters({ search: "rent", types: ["expense"], accountIds: [], minAmount: "100", from: "2026-11-01" }),
    ).toBe(4);
  });

  it("is zero with nothing set", () => {
    expect(countFilters({})).toBe(0);
  });
});
