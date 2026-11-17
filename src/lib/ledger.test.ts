import { describe, expect, it } from "vitest";

import { railDate } from "./ledger";

describe("railDate", () => {
  it("is the day of the month and the short weekday", () => {
    expect(railDate("2026-11-17")).toEqual({ date: "17", weekday: "Tue" });
    expect(railDate("2026-11-01")).toEqual({ date: "1", weekday: "Sun" });
  });
});
