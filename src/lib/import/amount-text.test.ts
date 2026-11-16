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
    expect(readAmount("250", 2)).toEqual({ kind: "value", minor: 25000n, marked: false });
    expect(readAmount("-250.5", 2)).toEqual({ kind: "value", minor: -25050n, marked: false });
    expect(readAmount("+12.05", 2)).toEqual({ kind: "value", minor: 1205n, marked: false });
  });

  it("strips currency symbols, spaces and grouping commas", () => {
    expect(readAmount("₹ 1,23,456.78", 2)).toEqual({ kind: "value", minor: 12345678n, marked: false });
    expect(readAmount("Rs. 1,000", 2)).toEqual({ kind: "value", minor: 100000n, marked: false });
    expect(readAmount("INR 99", 2)).toEqual({ kind: "value", minor: 9900n, marked: false });
    expect(readAmount("$1 234.50", 2)).toEqual({ kind: "value", minor: 123450n, marked: false });
  });

  it("reads accounting brackets as negative", () => {
    expect(readAmount("(123.45)", 2)).toEqual({ kind: "value", minor: -12345n, marked: false });
    expect(readAmount("(₹ 1,000)", 2)).toEqual({ kind: "value", minor: -100000n, marked: false });
  });

  it("reads a trailing Dr as negative and Cr as positive", () => {
    expect(readAmount("500.00 Dr", 2)).toEqual({ kind: "value", minor: -50000n, marked: true });
    expect(readAmount("500.00dr.", 2)).toEqual({ kind: "value", minor: -50000n, marked: true });
    expect(readAmount("500.00 CR", 2)).toEqual({ kind: "value", minor: 50000n, marked: true });
  });

  it("refuses a minus or brackets beside a Cr, which says the opposite", () => {
    expect(readAmount("-500 Cr", 2)).toEqual({ kind: "error", reason: "has two signs" });
    expect(readAmount("(500) Cr", 2)).toEqual({ kind: "error", reason: "has two signs" });
    expect(readAmount("-500 Dr", 2)).toEqual({ kind: "value", minor: -50000n, marked: true });
  });

  it("reads a trailing minus as negative", () => {
    expect(readAmount("75.00-", 2)).toEqual({ kind: "value", minor: -7500n, marked: true });
  });

  it("calls blank, a dash and zero not a record", () => {
    expect(readAmount("", 2)).toEqual({ kind: "blank" });
    expect(readAmount("   ", 2)).toEqual({ kind: "blank" });
    expect(readAmount("-", 2)).toEqual({ kind: "blank" });
    expect(readAmount("0.00", 2)).toEqual({ kind: "blank" });
    expect(readAmount("₹0", 2)).toEqual({ kind: "blank" });
  });

  it("keeps trailing zeros past the currency's places but refuses real ones", () => {
    expect(readAmount("10.5000", 2)).toEqual({ kind: "value", minor: 1050n, marked: false });
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

  it("reads a comma as the decimal mark in a semicolon file", () => {
    const comma = { decimalComma: true };
    expect(readAmount("12,50", 2, comma)).toEqual({ kind: "value", minor: 1250n, marked: false });
    expect(readAmount("-1.234,56", 2, comma)).toEqual({ kind: "value", minor: -123456n, marked: false });
    expect(readAmount("1.234", 2, comma)).toEqual({ kind: "value", minor: 123400n, marked: false });
    expect(readAmount("€ 1 234,5", 2, comma)).toEqual({ kind: "value", minor: 123450n, marked: false });
  });

  it("reads a final comma with one or two digits as the decimal mark anywhere", () => {
    expect(readAmount("12,5", 2)).toEqual({ kind: "value", minor: 1250n, marked: false });
    expect(readAmount("12,50", 2)).toEqual({ kind: "value", minor: 1250n, marked: false });
    expect(readAmount("1.234,56", 2)).toEqual({ kind: "value", minor: 123456n, marked: false });
    expect(readAmount("Rs. 1.234,56", 2)).toEqual({ kind: "value", minor: 123456n, marked: false });
  });

  it("keeps a comma before three digits, or before a point, as grouping", () => {
    expect(readAmount("1,234", 2)).toEqual({ kind: "value", minor: 123400n, marked: false });
    expect(readAmount("1,234.56", 2)).toEqual({ kind: "value", minor: 123456n, marked: false });
    expect(readAmount("1,23,456.78", 2)).toEqual({ kind: "value", minor: 12345678n, marked: false });
  });

  it("calls a mix it cannot be sure of unreadable rather than guessing", () => {
    const bad = { kind: "error", reason: "is not an amount" };
    expect(readAmount("1,234,5", 2)).toEqual(bad);
    expect(readAmount("1.23,45", 2)).toEqual(bad);
    expect(readAmount("1,234.56", 2, { decimalComma: true })).toEqual(bad);
    expect(readAmount("12.50", 2, { decimalComma: true })).toEqual(bad);
    expect(readAmount("1.234.56", 2)).toEqual(bad);
  });

  it("checks the places after the final separator", () => {
    expect(readAmount("1.234,567", 2, { decimalComma: true })).toEqual({
      kind: "error",
      reason: "has more than 2 decimal places",
    });
  });
});
