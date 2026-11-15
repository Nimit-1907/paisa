import { describe, expect, it } from "vitest";

import { evaluate, isExpression } from "./calculator";

/** Rupees: two decimal places. */
const inr = (expression: string) => evaluate(expression, 2);

describe("evaluate", () => {
  it("reads a plain amount", () => {
    expect(inr("120")).toEqual({ ok: true, minor: 12000n });
    expect(inr("120.50")).toEqual({ ok: true, minor: 12050n });
    expect(inr("0.07")).toEqual({ ok: true, minor: 7n });
    expect(inr("1,234.50")).toEqual({ ok: true, minor: 123450n });
  });

  it("adds and subtracts the way a split bill is typed", () => {
    expect(inr("120+45")).toEqual({ ok: true, minor: 16500n });
    expect(inr("120.50+45.25")).toEqual({ ok: true, minor: 16575n });
    expect(inr("500-120-45")).toEqual({ ok: true, minor: 33500n });
  });

  it("does not drift the way floats do", () => {
    // 0.1 + 0.2 === 0.30000000000000004 in IEEE 754.
    expect(inr("0.1+0.2")).toEqual({ ok: true, minor: 30n });
    expect(inr("1.15*100")).toEqual({ ok: true, minor: 11500n });
  });

  it("multiplies and divides", () => {
    expect(inr("12.5×4")).toEqual({ ok: true, minor: 5000n });
    expect(inr("1200÷3")).toEqual({ ok: true, minor: 40000n });
    expect(inr("7÷2")).toEqual({ ok: true, minor: 350n });
  });

  it("accepts the characters a keyboard produces", () => {
    expect(inr("12.5*4")).toEqual({ ok: true, minor: 5000n });
    expect(inr("1200/3")).toEqual({ ok: true, minor: 40000n });
  });

  it("gives × and ÷ precedence over + and −", () => {
    expect(inr("100+2×50")).toEqual({ ok: true, minor: 20000n });
    expect(inr("2×50+100")).toEqual({ ok: true, minor: 20000n });
    expect(inr("100-60÷2")).toEqual({ ok: true, minor: 7000n });
  });

  it("rounds the result to the currency, not the operands", () => {
    // A third of ten rupees is 3.333…, which is ₹3.33.
    expect(inr("10÷3")).toEqual({ ok: true, minor: 333n });
    // The same sum in a three-decimal currency keeps the extra digit.
    expect(evaluate("10÷3", 3)).toEqual({ ok: true, minor: 3333n });
    // And in a currency with no minor unit at all.
    expect(evaluate("10÷3", 0)).toEqual({ ok: true, minor: 3n });
  });

  it("keeps full precision through the middle of a sum", () => {
    // Rounding 10/3 to paise first would give 3.33 × 3 = 9.99.
    expect(inr("10÷3×3")).toEqual({ ok: true, minor: 1000n });
  });

  it("handles a leading minus and a negative result", () => {
    expect(inr("-50")).toEqual({ ok: true, minor: -5000n });
    expect(inr("100-120")).toEqual({ ok: true, minor: -2000n });
  });

  it("refuses what it cannot work out", () => {
    expect(inr("")).toEqual({ ok: false, error: "Enter an amount." });
    expect(inr("12++5").ok).toBe(false);
    expect(inr("12+").ok).toBe(false);
    expect(inr("+").ok).toBe(false);
    expect(inr("1.2.3").ok).toBe(false);
    expect(inr("abc").ok).toBe(false);
  });

  it("refuses to divide by zero", () => {
    expect(inr("10÷0")).toEqual({ ok: false, error: "Cannot divide by zero." });
  });

  it("works out nothing but arithmetic", () => {
    // The input is a string from a text field; it must never be executed as
    // code, so each of these has to come back as a refusal.
    for (const hostile of [
      "alert(1)",
      "1;alert(1)",
      "process.exit()",
      "${7*7}",
      "1+1)",
    ]) {
      expect(inr(hostile).ok, hostile).toBe(false);
    }
  });

  it("refuses an amount too large to survive JSON", () => {
    expect(inr("99999999999999999×100").ok).toBe(false);
  });
});

describe("isExpression", () => {
  it("tells a sum from an amount", () => {
    expect(isExpression("120")).toBe(false);
    expect(isExpression("-120")).toBe(false);
    expect(isExpression("120+45")).toBe(true);
    expect(isExpression("120-45")).toBe(true);
  });
});

