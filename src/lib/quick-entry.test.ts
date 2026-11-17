import { describe, expect, it } from "vitest";

import { parseQuickEntry } from "./quick-entry";

const accounts = [
  { id: "cash", name: "Cash" },
  { id: "hdfc", name: "HDFC Savings" },
  { id: "icici", name: "ICICI Credit Card" },
  { id: "paytm", name: "Paytm Wallet" },
];

const categories = [
  { id: "food", name: "Food", kind: "expense" as const },
  { id: "fuel", name: "Fuel", kind: "expense" as const },
  { id: "salary", name: "Salary", kind: "income" as const },
];

const keywords = {
  expense: { chai: "food", petrol: "fuel" },
  income: { salary: "salary" },
};

const parse = (text: string) =>
  parseQuickEntry(text, { accounts, categories, keywords });

describe("parseQuickEntry", () => {
  it("reads amount, note, account and a category from past notes", () => {
    expect(parse("250 chai cash")).toEqual({
      type: "expense",
      amount: "250",
      note: "chai",
      accountId: "cash",
      categoryId: "food",
    });
  });

  it("takes the amount wherever it is, with a currency mark or grouping", () => {
    expect(parse("chai ₹250").amount).toBe("250");
    expect(parse("petrol Rs 1,200").amount).toBe("1200");
    expect(parse("petrol rs.1200").amount).toBe("1200");
    expect(parse("chai 99.50").amount).toBe("99.50");
  });

  it("reads k as a thousand", () => {
    expect(parse("1.2k zomato icici").amount).toBe("1200");
    expect(parse("15k rent").amount).toBe("15000");
  });

  it("matches an account by the start of its name", () => {
    expect(parse("500 groceries icici").accountId).toBe("icici");
    expect(parse("500 groceries hdfc").accountId).toBe("hdfc");
  });

  it("takes a category named outright, and leaves it out of the note", () => {
    const parsed = parse("300 lunch food");
    expect(parsed.categoryId).toBe("food");
    expect(parsed.note).toBe("lunch");
  });

  it("is income with a leading plus", () => {
    const parsed = parse("+85000 salary hdfc");
    expect(parsed.type).toBe("income");
    expect(parsed.categoryId).toBe("salary");
  });

  it("leaves what it cannot tell as null", () => {
    expect(parse("chai")).toEqual({
      type: "expense",
      amount: null,
      note: "chai",
      accountId: null,
      categoryId: "food",
    });
    expect(parse("250 something new").categoryId).toBeNull();
    expect(parse("250").note).toBeNull();
  });

  it("ignores a zero or negative amount", () => {
    expect(parse("0 chai").amount).toBeNull();
  });

  it("does not take a short word for an account", () => {
    // "ca" is not enough to mean Cash.
    expect(parse("250 ca").accountId).toBeNull();
  });
});
