import { describe, expect, it } from "vitest";

import { currentMonth, currentMonthRange, monthRange } from "./dates";

describe("monthRange", () => {
  it("starts a month at local midnight, not UTC midnight", () => {
    // India is UTC+5:30, so November begins on 31 October at 18:30 UTC.
    expect(monthRange(2026, 11, "Asia/Kolkata")).toEqual({
      startsAt: "2026-10-31T18:30:00.000Z",
      endsAt: "2026-11-30T18:30:00.000Z",
      monthStart: "2026-11-01",
    });
  });

  it("agrees with UTC when the user is in UTC", () => {
    expect(monthRange(2026, 2, "UTC")).toEqual({
      startsAt: "2026-02-01T00:00:00.000Z",
      endsAt: "2026-03-01T00:00:00.000Z",
      monthStart: "2026-02-01",
    });
  });

  it("rolls over the year", () => {
    const december = monthRange(2026, 12, "UTC");
    expect(december.endsAt).toBe("2027-01-01T00:00:00.000Z");
  });

  it("handles a zone that is behind UTC", () => {
    // New York is UTC-5 in January.
    expect(monthRange(2026, 1, "America/New_York").startsAt).toBe(
      "2026-01-01T05:00:00.000Z",
    );
  });

  it("handles a month that starts inside daylight saving", () => {
    // New York is UTC-4 in July.
    expect(monthRange(2026, 7, "America/New_York").startsAt).toBe(
      "2026-07-01T04:00:00.000Z",
    );
  });

  it("handles a half-hour offset either side of midnight", () => {
    expect(monthRange(2026, 6, "Asia/Kathmandu").startsAt).toBe(
      "2026-05-31T18:15:00.000Z",
    );
  });
});

describe("currentMonth", () => {
  it("reads the calendar the user is on, not the server's", () => {
    // 20:00 UTC on 31 October is already 1 November in Kolkata.
    const instant = new Date("2026-10-31T20:00:00.000Z");

    expect(currentMonth("Asia/Kolkata", instant)).toEqual({
      year: 2026,
      month: 11,
    });
    expect(currentMonth("UTC", instant)).toEqual({ year: 2026, month: 10 });
  });

  it("feeds currentMonthRange", () => {
    const instant = new Date("2026-11-14T09:00:00.000Z");

    expect(currentMonthRange("Asia/Kolkata", instant)).toEqual(
      monthRange(2026, 11, "Asia/Kolkata"),
    );
  });
});
