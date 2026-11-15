import { describe, expect, it } from "vitest";

import { digitsOf, digitsToIso, isoToMasked, maskDate } from "./date-entry";

describe("maskDate", () => {
  it("draws the slashes itself as the digits arrive", () => {
    expect(maskDate("1")).toBe("1");
    expect(maskDate("15")).toBe("15");
    expect(maskDate("151")).toBe("15/1");
    expect(maskDate("1511")).toBe("15/11");
    expect(maskDate("15112")).toBe("15/11/2");
    expect(maskDate("15112026")).toBe("15/11/2026");
  });

  it("never leaves a trailing slash to backspace through", () => {
    expect(maskDate("15")).not.toMatch(/\/$/);
    expect(maskDate("1511")).not.toMatch(/\/$/);
  });

  it("ignores punctuation somebody types anyway, and stops at eight digits", () => {
    expect(maskDate("15/11/2026")).toBe("15/11/2026");
    expect(maskDate("15-11-2026")).toBe("15/11/2026");
    expect(maskDate("151120269")).toBe("15/11/2026");
  });
});

describe("digitsToIso", () => {
  it("reads day first", () => {
    expect(digitsToIso("15112026")).toBe("2026-11-15");
    expect(digitsToIso("01012026")).toBe("2026-01-01");
  });

  it("refuses a date the calendar does not have", () => {
    expect(digitsToIso("31022026")).toBeNull();
    expect(digitsToIso("29022026")).toBeNull();
    expect(digitsToIso("00112026")).toBeNull();
    expect(digitsToIso("15132026")).toBeNull();
  });

  it("accepts a real leap day", () => {
    expect(digitsToIso("29022028")).toBe("2028-02-29");
  });

  it("waits for all eight digits", () => {
    expect(digitsToIso("1511202")).toBeNull();
    expect(digitsToIso("")).toBeNull();
  });
});

describe("isoToMasked", () => {
  it("round-trips with digitsToIso", () => {
    const iso = digitsToIso("03122026");
    expect(iso).toBe("2026-12-03");
    expect(isoToMasked(iso!)).toBe("03/12/2026");
    expect(digitsOf(isoToMasked(iso!))).toBe("03122026");
  });

  it("is empty for anything that is not yyyy-mm-dd", () => {
    expect(isoToMasked("")).toBe("");
    expect(isoToMasked("2026-11")).toBe("");
  });
});
