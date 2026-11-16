import { describe, expect, it } from "vitest";

import { cleanAmount, parseAmount, pressKey } from "./amount";

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

describe("cleanAmount with negatives", () => {
  it("keeps a leading minus only where allowed", () => {
    expect(cleanAmount("-500", 2, "", { allowNegative: true })).toBe("-500");
    expect(cleanAmount("\u2212500", 2, "", { allowNegative: true })).toBe(
      "-500",
    );
    expect(cleanAmount("-500", 2)).toBe("500");
    expect(cleanAmount("5-00", 2, "", { allowNegative: true })).toBe("500");
  });
});

describe("pressKey", () => {
  const press = (keys: string[], decimals = 2, allowNegative = false) =>
    keys.reduce(
      (value, key) =>
        pressKey(value, key as Parameters<typeof pressKey>[1], decimals, {
          allowNegative,
        }),
      "",
    );

  it("builds an amount digit by digit", () => {
    expect(press(["4", "5", "0"])).toBe("450");
    expect(press(["3", "8", ".", "9", "5"])).toBe("38.95");
  });

  it("refuses a second point and a place too many", () => {
    expect(press(["1", ".", "5", "."])).toBe("1.5");
    expect(press(["1", ".", "2", "3", "4"])).toBe("1.23");
    expect(press(["1", "."], 0)).toBe("1");
  });

  it("drops leading zeros and starts a lone point at zero", () => {
    expect(press(["0", "0", "7"])).toBe("7");
    expect(press(["."])).toBe("0.");
    expect(press(["0", ".", "5"])).toBe("0.5");
  });

  it("backspaces and clears", () => {
    expect(press(["4", "5", "back"])).toBe("4");
    expect(press(["4", "back", "back"])).toBe("");
    expect(press(["4", "5", "clear"])).toBe("");
  });

  it("flips the sign only where allowed", () => {
    expect(press(["5", "sign"], 2, true)).toBe("-5");
    expect(press(["sign", "5"], 2, true)).toBe("-5");
    expect(press(["5", "sign", "sign"], 2, true)).toBe("5");
    expect(press(["5", "sign"])).toBe("5");
    expect(press(["sign", "5", "back"], 2, true)).toBe("");
  });

  it("stops at thirteen whole digits", () => {
    expect(press(Array.from({ length: 15 }, () => "9"))).toBe("9".repeat(13));
  });
});
