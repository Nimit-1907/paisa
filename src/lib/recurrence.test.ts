import { describe, expect, it } from "vitest";

import {
  addDays,
  dayDifference,
  describeSchedule,
  nextOccurrence,
  occurrencesBetween,
  occurrenceOn,
  type RecurrenceSchedule,
  scheduledOnOrAfter,
  upcoming,
} from "@/lib/recurrence";

/**
 * The same cases supabase/tests/recurring.test.sql asserts.
 *
 * Two implementations of one calendar: the database writes the rows, this
 * draws the upcoming list. If they disagree, the app promises a date it then
 * does not create — so these tests exist to pin them together, and the
 * numbers below are copied from the SQL file on purpose.
 */

const monthly31: RecurrenceSchedule = {
  frequency: "monthly",
  interval: 1,
  startDate: "2026-01-31",
  anchorDay: 31,
};

const fortnightly: RecurrenceSchedule = {
  frequency: "weekly",
  interval: 2,
  startDate: "2026-11-02",
};

const leapDay: RecurrenceSchedule = {
  frequency: "yearly",
  interval: 1,
  startDate: "2024-02-29",
  anchorDay: 29,
};

const series = (schedule: RecurrenceSchedule, count: number) =>
  Array.from({ length: count }, (_, n) => occurrenceOn(schedule, n));

describe("occurrenceOn", () => {
  it("clamps a monthly rule on the 31st through February and comes back", () => {
    expect(series(monthly31, 5)).toEqual([
      "2026-01-31",
      "2026-02-28",
      "2026-03-31",
      "2026-04-30",
      "2026-05-31",
    ]);
  });

  it("steps a fortnightly rule 14 days at a time", () => {
    expect(series(fortnightly, 4)).toEqual([
      "2026-11-02",
      "2026-11-16",
      "2026-11-30",
      "2026-12-14",
    ]);
  });

  it("never moves a weekly rule off its weekday", () => {
    const weekdays = new Set(
      series(fortnightly, 9).map((day) => new Date(`${day}T00:00:00Z`).getUTCDay()),
    );
    expect(weekdays.size).toBe(1);
  });

  it("waits out the common years for a rule on 29 February", () => {
    expect(series(leapDay, 5)).toEqual([
      "2024-02-29",
      "2025-02-28",
      "2026-02-28",
      "2027-02-28",
      "2028-02-29",
    ]);
  });

  it("ignores the anchor day for a daily rule", () => {
    expect(
      occurrenceOn(
        {
          frequency: "daily",
          interval: 3,
          startDate: "2026-01-30",
          anchorDay: 31,
        },
        2,
      ),
    ).toBe("2026-02-05");
  });

  it("anchors on the start day when no anchor is given", () => {
    expect(
      occurrenceOn(
        { frequency: "monthly", interval: 1, startDate: "2026-01-31" },
        1,
      ),
    ).toBe("2026-02-28");
  });

  it("carries a monthly rule across a year boundary", () => {
    expect(
      occurrenceOn(
        { frequency: "monthly", interval: 2, startDate: "2026-11-15" },
        3,
      ),
    ).toBe("2027-05-15");
  });
});

describe("scheduledOnOrAfter", () => {
  it("finds the next occurrence from the middle of a month", () => {
    expect(scheduledOnOrAfter(monthly31, "2026-03-01")).toBe("2026-03-31");
  });

  it("does not walk past the first occurrence", () => {
    expect(scheduledOnOrAfter(monthly31, "2026-01-01")).toBe("2026-01-31");
  });

  it("treats an occurrence as its own answer", () => {
    expect(scheduledOnOrAfter(monthly31, "2026-02-28")).toBe("2026-02-28");
  });

  it("settles the estimate when a clamped month lands early", () => {
    // The estimate for 1 March is February's occurrence, which is the 28th —
    // before the date asked for. Walking forward is what fixes it.
    expect(scheduledOnOrAfter(monthly31, "2026-02-27")).toBe("2026-02-28");
    expect(scheduledOnOrAfter(monthly31, "2026-03-30")).toBe("2026-03-31");
  });

  it("handles a date before the schedule starts", () => {
    expect(scheduledOnOrAfter(fortnightly, "2020-01-01")).toBe("2026-11-02");
  });
});

describe("nextOccurrence", () => {
  it("passes over a skipped date", () => {
    const schedule: RecurrenceSchedule = {
      ...fortnightly,
      skippedDates: ["2026-11-16"],
    };

    expect(nextOccurrence(schedule, "2026-11-03")).toBe("2026-11-30");
  });

  it("passes over a run of skipped dates", () => {
    const schedule: RecurrenceSchedule = {
      ...fortnightly,
      skippedDates: ["2026-11-16", "2026-11-30"],
    };

    expect(nextOccurrence(schedule, "2026-11-03")).toBe("2026-12-14");
  });

  it("stops at the end date", () => {
    const schedule: RecurrenceSchedule = {
      ...monthly31,
      endDate: "2026-04-15",
    };

    expect(nextOccurrence(schedule, "2026-03-01")).toBe("2026-03-31");
    expect(nextOccurrence(schedule, "2026-04-01")).toBeNull();
  });

  it("returns null when every remaining occurrence was skipped", () => {
    const schedule: RecurrenceSchedule = {
      ...monthly31,
      endDate: "2026-03-31",
      skippedDates: ["2026-03-31"],
    };

    expect(nextOccurrence(schedule, "2026-03-01")).toBeNull();
  });
});

describe("upcoming", () => {
  it("lists the next five dates a rule is due", () => {
    expect(upcoming(monthly31, 5, "2026-02-01")).toEqual([
      "2026-02-28",
      "2026-03-31",
      "2026-04-30",
      "2026-05-31",
      "2026-06-30",
    ]);
  });

  it("stops early at the end date rather than padding the list", () => {
    expect(
      upcoming({ ...monthly31, endDate: "2026-04-15" }, 5, "2026-02-01"),
    ).toEqual(["2026-02-28", "2026-03-31"]);
  });

  it("leaves out skipped dates without shortening the run", () => {
    expect(
      upcoming({ ...monthly31, skippedDates: ["2026-03-31"] }, 3, "2026-02-01"),
    ).toEqual(["2026-02-28", "2026-04-30", "2026-05-31"]);
  });
});

describe("occurrencesBetween", () => {
  it("covers the seven-day window the Records screen shows", () => {
    const daily: RecurrenceSchedule = {
      frequency: "daily",
      interval: 2,
      startDate: "2026-11-10",
    };

    expect(occurrencesBetween(daily, "2026-11-14", "2026-11-20")).toEqual([
      "2026-11-14",
      "2026-11-16",
      "2026-11-18",
      "2026-11-20",
    ]);
  });

  it("is empty when nothing falls inside the window", () => {
    expect(occurrencesBetween(monthly31, "2026-11-01", "2026-11-07")).toEqual([]);
  });

  it("includes both ends of the window", () => {
    expect(occurrencesBetween(fortnightly, "2026-11-02", "2026-11-16")).toEqual([
      "2026-11-02",
      "2026-11-16",
    ]);
  });
});

describe("describeSchedule", () => {
  it("words each frequency the way the list reads it", () => {
    expect(describeSchedule({ ...monthly31 })).toBe("Monthly on day 31");
    expect(describeSchedule(fortnightly)).toBe("Every 2 weeks on Mon");
    expect(describeSchedule(leapDay)).toBe("Yearly on 29 Feb");
    expect(
      describeSchedule({ frequency: "daily", interval: 1, startDate: "2026-11-14" }),
    ).toBe("Daily");
    expect(
      describeSchedule({ frequency: "daily", interval: 3, startDate: "2026-11-14" }),
    ).toBe("Every 3 days");
    expect(
      describeSchedule({
        frequency: "weekly",
        interval: 1,
        startDate: "2026-11-14",
      }),
    ).toBe("Weekly on Sat");
    expect(
      describeSchedule({
        frequency: "monthly",
        interval: 3,
        startDate: "2026-11-05",
      }),
    ).toBe("Every 3 months on day 5");
  });
});

describe("calendar helpers", () => {
  it("adds days across a month and a leap year", () => {
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
    expect(addDays("2024-02-28", 1)).toBe("2024-02-29");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
  });

  it("counts whole days in both directions", () => {
    expect(dayDifference("2026-11-01", "2026-11-14")).toBe(13);
    expect(dayDifference("2026-11-14", "2026-11-01")).toBe(-13);
    expect(dayDifference("2026-11-14", "2026-11-14")).toBe(0);
  });

  it("refuses a date that does not exist", () => {
    expect(() => addDays("2026-02-30", 1)).toThrow(RangeError);
    expect(() => occurrenceOn({ ...monthly31, startDate: "nope" }, 0)).toThrow(
      RangeError,
    );
  });
});
