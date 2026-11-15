import { describe, expect, it } from "vitest";

import {
  currentMonth,
  currentMonthRange,
  describeLocal,
  instantToLocal,
  localToInstant,
  monthRange,
  nextRecurrence,
} from "./dates";

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

describe("localToInstant / instantToLocal", () => {
  it("reads a picker value as local time, not UTC", () => {
    const instant = localToInstant("2026-11-14T13:45", "Asia/Kolkata");
    expect(instant?.toISOString()).toBe("2026-11-14T08:15:00.000Z");
  });

  it("keeps a late evening on its own day", () => {
    // 23:30 IST on the 30th is 18:00 UTC on the 30th — same day either way —
    // but 00:30 IST on the 1st is 19:00 UTC on the *previous* day.
    const instant = localToInstant("2026-12-01T00:30", "Asia/Kolkata");
    expect(instant?.toISOString()).toBe("2026-11-30T19:00:00.000Z");
  });

  it("round-trips through the picker format", () => {
    const local = "2026-07-04T09:05";

    for (const zone of ["Asia/Kolkata", "UTC", "America/New_York"]) {
      const instant = localToInstant(local, zone);
      expect(instantToLocal(instant!, zone), zone).toBe(local);
    }
  });

  it("renders midnight as 00:00, not 24:00", () => {
    const instant = localToInstant("2026-03-01T00:00", "Asia/Kolkata");
    expect(instantToLocal(instant!, "Asia/Kolkata")).toBe("2026-03-01T00:00");
  });

  it("stays correct through a daylight-saving change", () => {
    // New York springs forward at 02:00 on 8 March 2026: 03:30 that morning
    // is already EDT (-4), even though the day started on EST (-5).
    expect(
      localToInstant("2026-03-08T03:30", "America/New_York")?.toISOString(),
    ).toBe("2026-03-08T07:30:00.000Z");

    // And the evening before, still EST.
    expect(
      localToInstant("2026-03-07T23:30", "America/New_York")?.toISOString(),
    ).toBe("2026-03-08T04:30:00.000Z");

    // Autumn, back to EST.
    expect(
      localToInstant("2026-11-01T03:30", "America/New_York")?.toISOString(),
    ).toBe("2026-11-01T08:30:00.000Z");
  });

  it("refuses something that is not a date and time", () => {
    expect(localToInstant("not a date", "UTC")).toBeNull();
    expect(localToInstant("2026-11-14", "UTC")).toBeNull();
  });

  it("refuses a date that does not exist", () => {
    // These all pass a digit-counting pattern and would otherwise roll over
    // into a different day.
    for (const bad of [
      "2026-02-31T10:00",
      "2026-13-01T00:00",
      "2026-00-10T00:00",
      "2026-01-00T00:00",
      "2026-01-01T24:00",
      "2026-01-01T10:60",
      "2026-01-01T99:99",
    ]) {
      expect(localToInstant(bad, "UTC"), bad).toBeNull();
    }

    // A leap day is a real date; the day after it in a common year is not.
    expect(localToInstant("2028-02-29T10:00", "UTC")).not.toBeNull();
    expect(localToInstant("2026-02-29T10:00", "UTC")).toBeNull();
  });
});

describe("nextRecurrence", () => {
  it("clamps a month end instead of rolling it over", () => {
    expect(nextRecurrence("2026-01-31", "monthly", 1)).toBe("2026-02-28");
    expect(nextRecurrence("2028-01-31", "monthly", 1)).toBe("2028-02-29");
    expect(nextRecurrence("2026-01-31", "monthly", 2)).toBe("2026-03-31");
    expect(nextRecurrence("2026-03-31", "monthly", 1)).toBe("2026-04-30");
  });

  it("counts days and weeks", () => {
    expect(nextRecurrence("2026-11-14", "daily", 1)).toBe("2026-11-15");
    expect(nextRecurrence("2026-11-14", "daily", 10)).toBe("2026-11-24");
    expect(nextRecurrence("2026-11-14", "weekly", 1)).toBe("2026-11-21");
    expect(nextRecurrence("2026-11-28", "weekly", 2)).toBe("2026-12-12");
  });

  it("rolls the year over", () => {
    expect(nextRecurrence("2026-12-15", "monthly", 1)).toBe("2027-01-15");
    expect(nextRecurrence("2026-11-14", "yearly", 1)).toBe("2027-11-14");
    expect(nextRecurrence("2028-02-29", "yearly", 1)).toBe("2029-02-28");
  });
});

describe("describeLocal", () => {
  const today = "2026-11-15T09:05";

  it("names today and keeps the clock in 12-hour time", () => {
    expect(describeLocal("2026-11-15T13:30", today)).toBe("Today, 1:30 pm");
  });

  it("names yesterday, across a month boundary", () => {
    expect(describeLocal("2026-10-31T09:00", "2026-11-01T00:10")).toBe(
      "Yesterday, 9:00 am",
    );
  });

  it("reads midnight as 12 am and noon as 12 pm", () => {
    expect(describeLocal("2026-11-15T00:00", today)).toBe("Today, 12:00 am");
    expect(describeLocal("2026-11-15T12:00", today)).toBe("Today, 12:00 pm");
  });

  it("gives a date for anything further back, with the year only when it differs", () => {
    expect(describeLocal("2026-11-02T18:45", today)).toBe("2 Nov, 6:45 pm");
    expect(describeLocal("2025-12-31T18:45", today)).toBe(
      "31 Dec 2025, 6:45 pm",
    );
  });
});
