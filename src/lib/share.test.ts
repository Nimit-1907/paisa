import { describe, expect, it } from "vitest";

import { parseSharedPayment, sharedDraft } from "./share";

describe("parseSharedPayment", () => {
  it("reads a bank's UPI debit SMS", () => {
    expect(
      parseSharedPayment(
        "Rs.250.00 debited from a/c XX1234 on 17-11-26 to VPA swiggy@icici UPI Ref 631245789012. Not you? Call 1800",
      ),
    ).toEqual({ type: "expense", amount: "250", note: "swiggy" });
  });

  it("reads a UPI credit SMS as income, with who it came from", () => {
    expect(
      parseSharedPayment(
        "Rs 5,000 credited to your a/c XX1234 from RAHUL K on 17-11-26. UPI Ref 1234",
      ),
    ).toEqual({ type: "income", amount: "5000", note: "RAHUL K" });
  });

  it("reads a payment app's receipt", () => {
    expect(parseSharedPayment("You paid ₹450 to Rahul Sharma")).toEqual({
      type: "expense",
      amount: "450",
      note: "Rahul Sharma",
    });
    expect(parseSharedPayment("Paid ₹1,200 to Zomato via PhonePe")).toEqual({
      type: "expense",
      amount: "1200",
      note: "Zomato",
    });
  });

  it("keeps paise, without a padded zero", () => {
    expect(parseSharedPayment("INR 499.50 spent at Amazon").amount).toBe(
      "499.5",
    );
    expect(parseSharedPayment("Rs.12.05 debited").amount).toBe("12.05");
  });

  it("takes the first amount when there are two", () => {
    expect(
      parseSharedPayment("Rs 300 debited. Avl bal Rs 12,000.00").amount,
    ).toBe("300");
  });

  it("says when there is no amount", () => {
    expect(parseSharedPayment("Hello, lunch tomorrow?")).toEqual({
      type: "expense",
      amount: null,
      note: null,
    });
  });

  it("keeps a payee short", () => {
    const note = parseSharedPayment(
      `Paid ₹10 to ${"A very long merchant name ".repeat(5)}`,
    ).note;
    expect(note?.length).toBeLessThanOrEqual(60);
  });
});

describe("sharedDraft", () => {
  const options = {
    decimals: 2,
    timeZone: "Asia/Kolkata",
    now: new Date("2026-11-17T04:45:00.000Z"),
  };

  it("turns a payment into a new record's draft, dated now", () => {
    expect(
      sharedDraft("You paid ₹450.50 to Rahul Sharma", options),
    ).toMatchObject({
      type: "expense",
      amount: "45050",
      note: "Rahul Sharma",
      accountId: "",
      categoryId: null,
      occurredAtLocal: "2026-11-17T10:15",
      recurringRuleId: null,
    });
  });

  it("keeps the whole text as the note when nothing could be read", () => {
    expect(sharedDraft("  lunch with the team  ", options)).toMatchObject({
      amount: "0",
      note: "lunch with the team",
    });
  });

  it("caps a long shared text at a note's 500 characters", () => {
    expect(sharedDraft("x".repeat(900), options).note).toHaveLength(500);
  });
});
