import { describe, expect, it } from "vitest";

import { readDate } from "@/lib/import/date-text";

/**
 * A date as a statement prints it, into `yyyy-mm-dd`.
 *
 * The numeric formats are ambiguous (05/11 is May or November), so the
 * person says which one the file uses. A month written as a name is not
 * ambiguous and reads the same whichever they chose.
 */

describe("readDate", () => {
  it("reads DD/MM/YYYY", () => {
    expect(readDate("05/11/2026", "dmy")).toBe("2026-11-05");
    expect(readDate("5-11-2026", "dmy")).toBe("2026-11-05");
    expect(readDate("05.11.2026", "dmy")).toBe("2026-11-05");
  });

  it("reads MM/DD/YYYY", () => {
    expect(readDate("11/05/2026", "mdy")).toBe("2026-11-05");
    expect(readDate("11/5/26", "mdy")).toBe("2026-11-05");
  });

  it("reads YYYY-MM-DD", () => {
    expect(readDate("2026-11-05", "ymd")).toBe("2026-11-05");
    expect(readDate("2026/11/5", "ymd")).toBe("2026-11-05");
  });

  it("reads a two-digit year", () => {
    expect(readDate("05/11/26", "dmy")).toBe("2026-11-05");
    expect(readDate("05/11/99", "dmy")).toBe("1999-11-05");
  });

  it("ignores a time after the date", () => {
    expect(readDate("05/11/2026 14:32", "dmy")).toBe("2026-11-05");
    expect(readDate("2026-11-05T10:00:00Z", "ymd")).toBe("2026-11-05");
  });

  it("reads month names in any format", () => {
    for (const format of ["dmy", "mdy", "ymd"] as const) {
      expect(readDate("05 Nov 2026", format)).toBe("2026-11-05");
      expect(readDate("5-Nov-26", format)).toBe("2026-11-05");
      expect(readDate("Nov 5, 2026", format)).toBe("2026-11-05");
      expect(readDate("05 November 2026", format)).toBe("2026-11-05");
      expect(readDate("2026-Nov-05", format)).toBe("2026-11-05");
      expect(readDate("5 sept 2026", format)).toBe("2026-09-05");
    }
  });

  it("refuses a day that does not exist", () => {
    expect(readDate("31/02/2026", "dmy")).toBeNull();
    expect(readDate("29/02/2025", "dmy")).toBeNull();
    expect(readDate("29/02/2024", "dmy")).toBe("2024-02-29");
    expect(readDate("13/13/2026", "dmy")).toBeNull();
    expect(readDate("32 Jan 2026", "dmy")).toBeNull();
  });

  it("reads a four-digit year first in any format, since it cannot be misread", () => {
    for (const format of ["dmy", "mdy", "ymd"] as const) {
      expect(readDate("2026-11-05", format), format).toBe("2026-11-05");
      expect(readDate("2026/11/05 10:30", format), format).toBe("2026-11-05");
    }
    expect(readDate("2026-02-30", "dmy")).toBeNull();
  });

  it("refuses the wrong format rather than guessing", () => {
    expect(readDate("05/11/2026", "ymd")).toBeNull();
    expect(readDate("11/25/2026", "dmy")).toBeNull();
  });

  it("refuses what is not a date", () => {
    expect(readDate("", "dmy")).toBeNull();
    expect(readDate("yesterday", "dmy")).toBeNull();
    expect(readDate("05 Foo 2026", "dmy")).toBeNull();
  });
});
