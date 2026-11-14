import { describe, expect, it } from "vitest";

import {
  MoneyParseError,
  formatMoney,
  fromDb,
  fromMinor,
  toMinor,
  tryToMinor,
  usesIndianGrouping,
} from "./money";

describe("toMinor", () => {
  it("parses whole and fractional amounts", () => {
    expect(toMinor("0")).toBe(0n);
    expect(toMinor("1")).toBe(100n);
    expect(toMinor("1.5")).toBe(150n);
    expect(toMinor("1.05")).toBe(105n);
    expect(toMinor("1234.56")).toBe(123456n);
  });

  it("accepts keypad shorthands", () => {
    expect(toMinor(".5")).toBe(50n);
    expect(toMinor("5.")).toBe(500n);
    expect(toMinor("+99")).toBe(9900n);
  });

  it("ignores grouping separators, whitespace and currency symbols", () => {
    expect(toMinor("1,23,456.78")).toBe(12345678n);
    expect(toMinor("123,456.78")).toBe(12345678n);
    expect(toMinor("₹ 1,23,456.78")).toBe(12345678n);
    expect(toMinor("  1 234.50  ")).toBe(123450n);
    expect(toMinor("Rs.250")).toBe(25000n);
    expect(toMinor("Rs 250")).toBe(25000n);
    expect(toMinor("INR250")).toBe(25000n);
    expect(toMinor("250 USD")).toBe(25000n);
    expect(toMinor(" 1 000.00")).toBe(100000n);
  });

  it("rejects stray letters rather than deleting them", () => {
    // Deleting every letter run would read these as 15, 1234 and 10.
    for (const bad of ["1e5", "12abc34", "0x10", "5e"]) {
      expect(() => toMinor(bad), bad).toThrow(MoneyParseError);
    }
  });

  it("handles every sign notation", () => {
    expect(toMinor("-250.75")).toBe(-25075n);
    expect(toMinor("−250.75")).toBe(-25075n); // Unicode minus
    expect(toMinor("-₹5")).toBe(-500n);
    expect(toMinor("₹-5")).toBe(-500n);
    expect(toMinor("(500)")).toBe(-50000n); // accounting notation
  });

  it("rounds extra decimals half-away-from-zero", () => {
    expect(toMinor("1.004")).toBe(100n);
    expect(toMinor("1.005")).toBe(101n);
    expect(toMinor("1.006")).toBe(101n);
    expect(toMinor("-1.005")).toBe(-101n);
    expect(toMinor("0.999")).toBe(100n);
  });

  it("respects a custom decimals exponent", () => {
    expect(toMinor("1234.6", 0)).toBe(1235n);
    expect(toMinor("1234.4", 0)).toBe(1234n);
    expect(toMinor("1.2345", 3)).toBe(1235n);
    expect(toMinor("1.5", 0)).toBe(2n);
  });

  it("keeps precision past Number.MAX_SAFE_INTEGER", () => {
    expect(toMinor("99999999999999.99")).toBe(9999999999999999n);
    expect(toMinor("0.07")).toBe(7n); // 0.07 * 100 === 7.000000000000001 as a float
    expect(toMinor("1.15")).toBe(115n); // 1.15 * 100 === 114.99999999999999
  });

  it("rejects strings that are not amounts", () => {
    const bads = [
      "",
      "   ",
      "abc",
      "₹",
      "1.2.3",
      "--5",
      "5-",
      "1-2",
      ".",
      "1@00",
      "1_000",
      "50%",
    ];
    for (const bad of bads) {
      expect(() => toMinor(bad), bad).toThrow(MoneyParseError);
    }
  });

  it("rejects an unusable decimals exponent", () => {
    expect(() => toMinor("1", -1)).toThrow(RangeError);
    expect(() => toMinor("1", 2.5)).toThrow(RangeError);
    expect(() => toMinor("1", 9)).toThrow(RangeError);
  });
});

describe("tryToMinor", () => {
  it("returns null instead of throwing", () => {
    expect(tryToMinor("12.34")).toBe(1234n);
    expect(tryToMinor("")).toBeNull();
    expect(tryToMinor("abc")).toBeNull();
  });
});

describe("fromDb", () => {
  it("accepts what PostgREST returns for a bigint column", () => {
    expect(fromDb(12345678)).toBe(12345678n);
    expect(fromDb(-50000)).toBe(-50000n);
    expect(fromDb(0)).toBe(0n);
    expect(fromDb(null)).toBe(0n);
    expect(fromDb("9007199254740993")).toBe(9007199254740993n);
    expect(fromDb(123n)).toBe(123n);
  });

  it("refuses a value that already lost precision", () => {
    expect(() => fromDb(1.5)).toThrow(MoneyParseError);
    expect(() => fromDb(Number.MAX_SAFE_INTEGER + 2)).toThrow(MoneyParseError);
    expect(() => fromDb("12.5")).toThrow(MoneyParseError);
  });
});

describe("fromMinor", () => {
  it("renders an ungrouped decimal string", () => {
    expect(fromMinor(0n)).toBe("0.00");
    expect(fromMinor(5n)).toBe("0.05");
    expect(fromMinor(50n)).toBe("0.50");
    expect(fromMinor(123450n)).toBe("1234.50");
    expect(fromMinor(9999999999999999n)).toBe("99999999999999.99");
  });

  it("keeps the sign", () => {
    expect(fromMinor(-5n)).toBe("-0.05");
    expect(fromMinor(-123450n)).toBe("-1234.50");
  });

  it("respects a custom decimals exponent", () => {
    expect(fromMinor(1234n, 0)).toBe("1234");
    expect(fromMinor(1234n, 3)).toBe("1.234");
    expect(fromMinor(1n, 3)).toBe("0.001");
  });

  it("round-trips with toMinor", () => {
    for (const minor of [0n, 1n, 999n, -4250n, 12345678n, -9999999999999999n]) {
      expect(toMinor(fromMinor(minor))).toBe(minor);
    }
  });
});

describe("formatMoney", () => {
  it("groups ₹ amounts Indian-style", () => {
    expect(formatMoney(0n)).toBe("₹0.00");
    expect(formatMoney(100n)).toBe("₹1.00");
    expect(formatMoney(99999n)).toBe("₹999.99");
    expect(formatMoney(100000n)).toBe("₹1,000.00");
    expect(formatMoney(10000000n)).toBe("₹1,00,000.00");
    expect(formatMoney(12345678n)).toBe("₹1,23,456.78");
    expect(formatMoney(123456789012n)).toBe("₹1,23,45,67,890.12");
  });

  it("groups other currencies Western-style", () => {
    expect(formatMoney(12345678n, { symbol: "$" })).toBe("$123,456.78");
    expect(formatMoney(123456789012n, { symbol: "€" })).toBe("€1,234,567,890.12");
    expect(formatMoney(12345678n, { symbol: "" })).toBe("123,456.78");
  });

  it("treats the Indian rupee's aliases as Indian", () => {
    expect(formatMoney(12345678n, { symbol: "Rs." })).toBe("Rs.1,23,456.78");
    expect(usesIndianGrouping("₹")).toBe(true);
    expect(usesIndianGrouping("INR")).toBe(true);
    expect(usesIndianGrouping("$")).toBe(false);
  });

  it("allows overriding the grouping", () => {
    expect(formatMoney(12345678n, { symbol: "$", grouping: "indian" })).toBe(
      "$1,23,456.78",
    );
    expect(formatMoney(12345678n, { grouping: "western" })).toBe("₹123,456.78");
    expect(formatMoney(12345678n, { grouping: "none" })).toBe("₹123456.78");
  });

  it("supports the sign display the record list needs", () => {
    expect(formatMoney(-50000n)).toBe("-₹500.00");
    expect(formatMoney(50000n, { signDisplay: "always" })).toBe("+₹500.00");
    expect(formatMoney(-50000n, { signDisplay: "always" })).toBe("-₹500.00");
    expect(formatMoney(-50000n, { signDisplay: "never" })).toBe("₹500.00");
    expect(formatMoney(0n, { signDisplay: "always" })).toBe("+₹0.00");
  });

  it("respects a custom decimals exponent", () => {
    expect(formatMoney(1234n, { decimals: 0 })).toBe("₹1,234");
    expect(formatMoney(1234567n, { decimals: 3, symbol: "$" })).toBe(
      "$1,234.567",
    );
  });
});
