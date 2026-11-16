import { describe, expect, it } from "vitest";

import { autoMap, normaliseHeader } from "@/lib/import/columns";

/**
 * Matching a file's header row to what a record needs.
 *
 * The synonyms are the ones Indian bank statements and the common money apps
 * actually print. A match that is wrong is worse than none, so only whole
 * names count: "Amount" matches, "Amount Type" does not.
 */

describe("normaliseHeader", () => {
  it("lowercases, drops punctuation and a bracketed unit", () => {
    expect(normaliseHeader("  Withdrawal Amt. ")).toBe("withdrawal amt");
    expect(normaliseHeader("Amount (INR)")).toBe("amount");
    expect(normaliseHeader("Txn_Date")).toBe("txn date");
  });
});

describe("autoMap", () => {
  it("maps a single amount column", () => {
    expect(autoMap(["Date", "Narration", "Amount"])).toEqual({
      date: 0,
      description: 1,
      amount: 2,
      debit: null,
      credit: null,
      mode: "single",
    });
  });

  it("picks the debit and credit pair when both exist", () => {
    expect(
      autoMap([
        "Date",
        "Narration",
        "Chq./Ref.No.",
        "Value Dt",
        "Withdrawal Amt.",
        "Deposit Amt.",
        "Closing Balance",
      ]),
    ).toEqual({
      date: 0,
      description: 1,
      amount: null,
      debit: 4,
      credit: 5,
      mode: "split",
    });
  });

  it("prefers the pair over a lone amount column", () => {
    const mapping = autoMap(["Date", "Amount", "Dr", "Cr"]);

    expect(mapping.mode).toBe("split");
    expect(mapping.debit).toBe(2);
    expect(mapping.credit).toBe(3);
  });

  it("stays on a single amount when only one of the pair exists", () => {
    const mapping = autoMap(["Date", "Debit", "Amt"]);

    expect(mapping.mode).toBe("single");
    expect(mapping.amount).toBe(2);
  });

  it("prefers the transaction date over the value date", () => {
    expect(autoMap(["Value Date", "Transaction Date", "Amount"]).date).toBe(1);
  });

  it("is case-insensitive and matches every listed synonym", () => {
    for (const name of ["date", "TXN DATE", "Transaction date", "Value Date", "Posting Date"]) {
      expect(autoMap([name]).date, name).toBe(0);
    }
    for (const name of ["description", "Narration", "REMARKS", "Particulars", "Details", "Note", "memo"]) {
      expect(autoMap([name]).description, name).toBe(0);
    }
  });

  it("leaves what it cannot find unmapped", () => {
    expect(autoMap(["When", "How much"])).toEqual({
      date: null,
      description: null,
      amount: null,
      debit: null,
      credit: null,
      mode: "single",
    });
  });

  it("never maps one column to two roles", () => {
    const mapping = autoMap(["Date", "Date", "Amount"]);

    expect(mapping.date).toBe(0);
  });
});
