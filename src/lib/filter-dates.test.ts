import { describe, expect, it } from "vitest";

import { monthPresets } from "./filter-dates";

describe("monthPresets", () => {
  it("is today, yesterday and the last seven days on the running month", () => {
    expect(monthPresets("2026-11", "2026-11-17")).toEqual([
      { label: "Today", from: "2026-11-17", to: "2026-11-17" },
      { label: "Yesterday", from: "2026-11-16", to: "2026-11-16" },
      { label: "Last 7 days", from: "2026-11-11", to: "2026-11-17" },
    ]);
  });

  it("never reaches back into the month before", () => {
    expect(monthPresets("2026-11", "2026-11-03")).toEqual([
      { label: "Today", from: "2026-11-03", to: "2026-11-03" },
      { label: "Yesterday", from: "2026-11-02", to: "2026-11-02" },
      { label: "Last 7 days", from: "2026-11-01", to: "2026-11-03" },
    ]);
  });

  it("has no yesterday on the 1st", () => {
    expect(monthPresets("2026-11", "2026-11-01").map((p) => p.label)).toEqual([
      "Today",
      "Last 7 days",
    ]);
  });

  it("is the month's weeks on a month that is over", () => {
    expect(monthPresets("2026-10", "2026-11-17")).toEqual([
      { label: "1–7 Oct", from: "2026-10-01", to: "2026-10-07" },
      { label: "8–14 Oct", from: "2026-10-08", to: "2026-10-14" },
      { label: "15–21 Oct", from: "2026-10-15", to: "2026-10-21" },
      { label: "22–31 Oct", from: "2026-10-22", to: "2026-10-31" },
    ]);
  });

  it("ends February's last week on its last day", () => {
    expect(monthPresets("2026-02", "2026-11-17").at(-1)).toEqual({
      label: "22–28 Feb",
      from: "2026-02-22",
      to: "2026-02-28",
    });
  });
});

describe("monthBounds", () => {
  it("is the first day and the last day that can be chosen", async () => {
    const { monthBounds } = await import("./filter-dates");
    expect(monthBounds("2026-11", "2026-11-17")).toEqual({
      min: "2026-11-01",
      max: "2026-11-17",
    });
    expect(monthBounds("2026-10", "2026-11-17")).toEqual({
      min: "2026-10-01",
      max: "2026-10-31",
    });
  });
});
