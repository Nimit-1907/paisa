import { describe, expect, it } from "vitest";

import {
  buildKeywordMap,
  guessCategory,
  noteKeyword,
} from "@/lib/import/category-guess";

/**
 * A category for each imported row, from the person's own history.
 *
 * Deliberately blunt: the first meaningful word of a note, matched exactly.
 * A guess that is wrong is a row filed under the wrong budget, so it would
 * rather leave a row to the fallback than be clever.
 */

describe("noteKeyword", () => {
  it("takes the first word, lowercased", () => {
    expect(noteKeyword("Swiggy dinner")).toBe("swiggy");
  });

  it("skips stop words and words under three letters", () => {
    expect(noteKeyword("UPI/SWIGGY/412345/Payment")).toBe("swiggy");
    expect(noteKeyword("POS 4123 XX AMAZON.IN")).toBe("amazon");
    expect(noteKeyword("NEFT from Acme Ltd salary")).toBe("acme");
    expect(noteKeyword("to Mr Sharma")).toBe("sharma");
  });

  it("strips digits and punctuation inside a word", () => {
    expect(noteKeyword("Uber123 trip")).toBe("uber");
    expect(noteKeyword("McDonald's")).toBe("mcdonalds");
  });

  it("has nothing for a note without a meaningful word", () => {
    expect(noteKeyword("")).toBeNull();
    expect(noteKeyword(null)).toBeNull();
    expect(noteKeyword("UPI 12345 to")).toBeNull();
  });
});

const FOOD = "11111111-1111-4111-8111-111111111111";
const SHOP = "22222222-2222-4222-8222-222222222222";
const SALARY = "33333333-3333-4333-8333-333333333333";

describe("buildKeywordMap and guessCategory", () => {
  const map = buildKeywordMap([
    { type: "expense", note: "Swiggy lunch", categoryId: FOOD },
    { type: "expense", note: "swiggy instamart", categoryId: SHOP },
    { type: "expense", note: "Swiggy dinner", categoryId: FOOD },
    { type: "income", note: "Acme salary", categoryId: SALARY },
    { type: "expense", note: null, categoryId: FOOD },
    { type: "transfer", note: "Swiggy", categoryId: null },
  ]);

  it("guesses the most used category for the keyword and type", () => {
    expect(guessCategory(map, "expense", "UPI/SWIGGY/88/food")).toBe(FOOD);
    expect(guessCategory(map, "income", "NEFT ACME LTD")).toBe(SALARY);
  });

  it("keeps the two types apart", () => {
    expect(guessCategory(map, "income", "Swiggy refund")).toBeNull();
  });

  it("has no guess for a word it has not seen", () => {
    expect(guessCategory(map, "expense", "Zomato")).toBeNull();
    expect(guessCategory(map, "expense", "")).toBeNull();
  });

  it("breaks a tie towards the most recent, which comes first", () => {
    const tied = buildKeywordMap([
      { type: "expense", note: "Amazon books", categoryId: SHOP },
      { type: "expense", note: "Amazon fresh", categoryId: FOOD },
    ]);

    expect(guessCategory(tied, "expense", "amazon")).toBe(SHOP);
  });
});
