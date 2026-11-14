/**
 * The arithmetic behind the amount keypad.
 *
 * People type "120+45" or "1200/3" when logging a split bill, so the amount
 * field has to work the sum out as well as collect it. It does that by
 * parsing, never by executing: the input is a string from a text field, and
 * handing one of those to the JavaScript engine is how a keypad turns into a
 * scripting console.
 *
 * Everything is done in BigInt at a fixed internal scale, so "0.1+0.2" is
 * 0.3 rather than 0.30000000000000004, and the result is only rounded when it
 * becomes minor units at the end.
 */

import { MoneyParseError, tryToMinor } from "./money";

export const OPERATORS = ["+", "-", "×", "÷"] as const;
export type Operator = (typeof OPERATORS)[number];

/** Digits of headroom kept during the sum; results round to the currency. */
const SCALE = 9n;
const SCALE_FACTOR = 10n ** SCALE;

export type CalculationResult =
  | { ok: true; minor: bigint }
  | { ok: false; error: string };

type Token = { kind: "number"; value: bigint } | { kind: "op"; value: Operator };

/** Decimal text → BigInt at the internal scale. "12.5" → 12_500_000_000n */
function toScaled(text: string): bigint | null {
  if (!/^\d*\.?\d*$/.test(text) || text === "" || text === ".") return null;

  const [whole = "", fraction = ""] = text.split(".");
  const padded = fraction.slice(0, Number(SCALE)).padEnd(Number(SCALE), "0");

  return BigInt(whole || "0") * SCALE_FACTOR + BigInt(padded || "0");
}

/**
 * Splits an expression into numbers and operators.
 *
 * A leading "-" is part of the first number; every other "-" is subtraction,
 * so "-5+2" and "5-2" both read the way they look.
 */
function tokenize(expression: string): Token[] | null {
  const input = expression.replace(/\s|,/g, "").replace(/[*xX]/g, "×").replace(/\//g, "÷");
  if (input === "") return null;

  const tokens: Token[] = [];
  let current = "";
  let negate = false;

  const flushNumber = () => {
    const scaled = toScaled(current);
    if (scaled === null) return false;
    tokens.push({ kind: "number", value: negate ? -scaled : scaled });
    current = "";
    negate = false;
    return true;
  };

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];

    if (/[\d.]/.test(char)) {
      current += char;
      continue;
    }

    if (!OPERATORS.includes(char as Operator)) return null;

    // A sign rather than an operator: at the very start, or straight after
    // another operator.
    const atStart = tokens.length === 0 && current === "";
    const afterOperator =
      current === "" && tokens.at(-1)?.kind === "op";

    if (char === "-" && (atStart || afterOperator)) {
      if (negate) return null;
      negate = true;
      continue;
    }

    if (current === "") return null;
    if (!flushNumber()) return null;
    tokens.push({ kind: "op", value: char as Operator });
  }

  if (current === "") return null;
  if (!flushNumber()) return null;

  return tokens;
}

/** Division and multiplication at the internal scale, rounded half away. */
function apply(left: bigint, operator: Operator, right: bigint): bigint | null {
  switch (operator) {
    case "+":
      return left + right;
    case "-":
      return left - right;
    case "×":
      return divideRounded(left * right, SCALE_FACTOR);
    case "÷":
      if (right === 0n) return null;
      return divideRounded(left * SCALE_FACTOR, right);
  }
}

function divideRounded(numerator: bigint, denominator: bigint): bigint {
  const negative = numerator < 0n !== denominator < 0n;
  const a = numerator < 0n ? -numerator : numerator;
  const b = denominator < 0n ? -denominator : denominator;

  const quotient = a / b;
  const remainder = a % b;
  const rounded = remainder * 2n >= b ? quotient + 1n : quotient;

  return negative ? -rounded : rounded;
}

/**
 * Evaluates a keypad expression into minor units.
 *
 * `decimals` is the user's currency exponent, so "1/3" lands on 0.33 for
 * rupees and 0.333 for dinars.
 */
export function evaluate(
  expression: string,
  decimals: number,
): CalculationResult {
  const trimmed = expression.trim();

  if (trimmed === "") return { ok: false, error: "Enter an amount." };

  // A plain number keeps the money parser's own tolerances (grouping, a
  // currency symbol, a trailing dot) rather than the stricter grammar below.
  if (!/[+\-×÷*/xX]/.test(trimmed.slice(1))) {
    const minor = tryToMinor(trimmed, decimals);
    if (minor !== null) return { ok: true, minor };
  }

  const tokens = tokenize(trimmed);
  if (!tokens) return { ok: false, error: "That is not a sum we can work out." };

  // Two passes, so × and ÷ bind tighter than + and −.
  const reduced: Token[] = [];

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];

    if (
      token.kind === "op" &&
      (token.value === "×" || token.value === "÷")
    ) {
      const left = reduced.pop();
      const right = tokens[index + 1];

      if (left?.kind !== "number" || right?.kind !== "number") {
        return { ok: false, error: "That is not a sum we can work out." };
      }

      const value = apply(left.value, token.value, right.value);
      if (value === null) return { ok: false, error: "Cannot divide by zero." };

      reduced.push({ kind: "number", value });
      index += 1;
      continue;
    }

    reduced.push(token);
  }

  const total = reduced[0];
  if (total?.kind !== "number") {
    return { ok: false, error: "That is not a sum we can work out." };
  }

  let running = total.value;

  for (let index = 1; index < reduced.length; index += 2) {
    const operator = reduced[index];
    const operand = reduced[index + 1];

    if (operator?.kind !== "op" || operand?.kind !== "number") {
      return { ok: false, error: "That is not a sum we can work out." };
    }

    const value = apply(running, operator.value, operand.value);
    if (value === null) return { ok: false, error: "Cannot divide by zero." };
    running = value;
  }

  // Scale down to minor units, rounding half away from zero.
  const factor = 10n ** (SCALE - BigInt(decimals));
  const minor = divideRounded(running, factor);

  if (minor > 9007199254740991n || minor < -9007199254740991n) {
    return { ok: false, error: "That amount is too large." };
  }

  return { ok: true, minor };
}

/** True when the text has something to work out rather than just a number. */
export function isExpression(text: string): boolean {
  return /[+\-×÷*/]/.test(text.trim().slice(1));
}

/**
 * Appends a keypad press to the current expression, keeping it well formed:
 * no two operators in a row, no second decimal point in one number.
 */
export function pressKey(expression: string, key: string): string {
  if (key === "backspace") return expression.slice(0, -1);
  if (key === "clear") return "";

  const last = expression.at(-1);

  if (OPERATORS.includes(key as Operator)) {
    if (expression === "") return key === "-" ? key : expression;
    if (last && OPERATORS.includes(last as Operator)) {
      return expression.slice(0, -1) + key;
    }
    return expression + key;
  }

  if (key === ".") {
    const currentNumber = expression.split(/[+\-×÷]/).at(-1) ?? "";
    if (currentNumber.includes(".")) return expression;
    if (currentNumber === "") return `${expression}0.`;
    return expression + key;
  }

  if (!/^\d$/.test(key)) return expression;

  // No leading zeros: "0" then "5" is 5, not 05.
  const currentNumber = expression.split(/[+\-×÷]/).at(-1) ?? "";
  if (currentNumber === "0") return expression.slice(0, -1) + key;

  return expression + key;
}

export { MoneyParseError };
