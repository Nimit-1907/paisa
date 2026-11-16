import { describe, expect, it } from "vitest";

import { readAmount } from "@/lib/import/amount-text";

/**
 * An amount as a statement prints it, into signed minor units.
 *
 * Negative means money left the account. Blank and zero are not errors:
 * a debit/credit pair leaves one of the two empty on every row.
 */

describe("readAmount", () => {
  it("reads plain, signed and decimal amounts", () => {
    expect(readAmount("250", 2)).toEqual({ kind: "value", minor: 25000n });
    expect(readAmount("-250.5", 2)).toEqual({ kind: "value", minor: -25050n });
    expect(readAmount("+12.05", 2)).toEqual({ kind: "value", minor: 1205n });
  });

  it("strips currency symbols, spaces and grouping commas", () => {
    expect(readAmount("₹ 1,23,456.78", 2)).toEqual({ kind: "value", minor: 12345678n });
    expect(readAmount("Rs. 1,000", 2)).toEqual({ kind: "value", minor: 100000n });
    expect(readAmount("INR 99", 2)).toEqual({ kind: "value", minor: 9900n });
    expect(readAmount("$1 234.50", 2)).toEqual({ kind: "value", minor: 123450n });
  });

  it("reads accounting brackets as negative", () => {
    expect(readAmount("(123.45)", 2)).toEqual({ kind: "value", minor: -12345n });
    expect(readAmount("(₹ 1,000)", 2)).toEqual({ kind: "value", minor: -100000n });
  });

  it("reads a trailing Dr as negative and Cr as positive", () => {
    expect(readAmount("500.00 Dr", 2)).toEqual({ kind: "value", minor: -50000n });
    expect(readAmount("500.00dr.", 2)).toEqual({ kind: "value", minor: -50000n });
    expect(readAmount("500.00 CR", 2)).toEqual({ kind: "value", minor: 50000n });
  });

  it("refuses a minus or brackets beside a Cr, which says the opposite", () => {
    expect(readAmount("-500 Cr", 2)).toEqual({ kind: "error", reason: "has two signs" });
    expect(readAmount("(500) Cr", 2)).toEqual({ kind: "error", reason: "has two signs" });
    expect(readAmount("-500 Dr", 2)).toEqual({ kind: "value", minor: -50000n });
  });

  it("reads a trailing minus as negative", () => {
    expect(readAmount("75.00-", 2)).toEqual({ kind: "value", minor: -7500n });
  });

  it("calls blank, a dash and zero not a record", () => {
    expect(readAmount("", 2)).toEqual({ kind: "blank" });
    expect(readAmount("   ", 2)).toEqual({ kind: "blank" });
    expect(readAmount("-", 2)).toEqual({ kind: "blank" });
    expect(readAmount("0.00", 2)).toEqual({ kind: "blank" });
    expect(readAmount("₹0", 2)).toEqual({ kind: "blank" });
  });

  it("keeps trailing zeros past the currency's places but refuses real ones", () => {
    expect(readAmount("10.5000", 2)).toEqual({ kind: "value", minor: 1050n });
    expect(readAmount("10.555", 2)).toEqual({
      kind: "error",
      reason: "has more than 2 decimal places",
    });
    expect(readAmount("10.5", 0)).toEqual({
      kind: "error",
      reason: "has decimal places this currency does not use",
    });
  });

  it("refuses what is not a number", () => {
    expect(readAmount("abc", 2)).toEqual({ kind: "error", reason: "is not an amount" });
    expect(readAmount("12a", 2)).toEqual({ kind: "error", reason: "is not an amount" });
    expect(readAmount("1.2.3", 2)).toEqual({ kind: "error", reason: "is not an amount" });
    expect(readAmount("--5", 2)).toEqual({ kind: "error", reason: "is not an amount" });
  });

  it("refuses an amount too large to store exactly", () => {
    expect(readAmount("999999999999999999", 2)).toEqual({
      kind: "error",
      reason: "is too large",
    });
  });
});
