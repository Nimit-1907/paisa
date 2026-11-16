import { describe, expect, it } from "vitest";

import { cleanAmount, parseAmount } from "./amount";

describe("cleanAmount", () => {
  it("keeps digits and one point", () => {
    expect(cleanAmount("450.5", 2)).toBe("450.5");
    expect(cleanAmount("4.5.0", 2)).toBe("4.50");
    expect(cleanAmount("1.2.3.4", 2)).toBe("1.234");
  });

  it("refuses operators and letters", () => {
    expect(cleanAmount("120+45", 2)).toBe("12045");
    expect(cleanAmount("1200/3", 2)).toBe("12003");
    expect(cleanAmount("-50", 2)).toBe("50");
    expect(cleanAmount("abc", 2)).toBe("");
  });

  it("drops grouping from a paste", () => {
    expect(cleanAmount("1,23,456.78", 2)).toBe("123456.78");
    expect(cleanAmount("₹ 2 500", 2)).toBe("2500");
  });

  it("refuses one place too many as it is typed", () => {
    expect(cleanAmount("10.999", 2, "10.99")).toBe("10.99");
    expect(cleanAmount("10.", 0, "10")).toBe("10");
  });

  it("keeps a paste with too many places whole, for parseAmount to flag", () => {
    expect(cleanAmount("10.999", 2, "")).toBe("10.999");
    expect(parseAmount("10.999", 2)).toEqual({
      ok: false,
      error: "Use at most 2 decimal places.",
    });
    expect(parseAmount("10.5", 0).ok).toBe(false);
  });
});

describe("parseAmount", () => {
  it("reads a plain amount into minor units", () => {
    expect(parseAmount("450", 2)).toEqual({ ok: true, minor: 45000n });
    expect(parseAmount("450.5", 2)).toEqual({ ok: true, minor: 45050n });
    expect(parseAmount("450.", 2)).toEqual({ ok: true, minor: 45000n });
    expect(parseAmount(".5", 2)).toEqual({ ok: true, minor: 50n });
    expect(parseAmount("1200", 0)).toEqual({ ok: true, minor: 1200n });
  });

  it("refuses a sum", () => {
    expect(parseAmount("120+45", 2).ok).toBe(false);
    expect(parseAmount("1200÷3", 2).ok).toBe(false);
  });

  it("refuses too many places, empty and huge", () => {
    expect(parseAmount("1.005", 2).ok).toBe(false);
    expect(parseAmount("", 2)).toEqual({
      ok: false,
      error: "Enter an amount.",
    });
    expect(parseAmount("99999999999999999", 2).ok).toBe(false);
  });
});
