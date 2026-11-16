import { MoneyParseError, toMinor } from "@/lib/money";

/**
 * An amount as a statement prints it, into signed minor units.
 *
 * Negative is money out. Beyond what `toMinor` already reads (a symbol, a
 * currency word, grouping commas and spaces, accounting brackets), banks
 * add a trailing "Dr"/"Cr" and sometimes a trailing minus. A blank cell, a
 * lone dash and a zero are "not a record", which is different from "cannot
 * read this": a debit/credit pair leaves one of the two empty on every row.
 */
export type AmountText =
  | { kind: "value"; minor: bigint }
  | { kind: "blank" }
  | { kind: "error"; reason: string };

const NOT_AN_AMOUNT: AmountText = { kind: "error", reason: "is not an amount" };

export function readAmount(text: string, decimals: number): AmountText {
  let body = text.replace(/[\s ]+/g, " ").trim();

  if (body === "" || /^[-\u2212\u2013\u2014]$/.test(body)) {
    return { kind: "blank" };
  }

  // What the trailing marker says, if there is one: "Dr" is money out,
  // "Cr" money in, a trailing minus out.
  let marked: "negative" | "positive" | null = null;

  const marker = /\s*(dr|cr)\.?$/i.exec(body);
  if (marker) {
    marked = marker[1].toLowerCase() === "dr" ? "negative" : "positive";
    body = body.slice(0, marker.index).trim();
  } else if (/\d\s*-$/.test(body)) {
    marked = "negative";
    body = body.slice(0, -1).trim();
  }

  // Places past the currency's are refused unless they are only zeros:
  // "10.5000" is ₹10.50, "10.555" is a figure Paisa cannot store exactly,
  // and rounding it would book a different amount from the statement's.
  const fraction = /\.(\d+)\D*$/.exec(body)?.[1] ?? "";
  const extra = fraction.slice(decimals);
  if (/[1-9]/.test(extra)) {
    return {
      kind: "error",
      reason:
        decimals === 0
          ? "has decimal places this currency does not use"
          : `has more than ${decimals} decimal places`,
    };
  }

  let minor: bigint;
  try {
    minor = toMinor(body, decimals);
  } catch (thrown) {
    if (thrown instanceof MoneyParseError) return NOT_AN_AMOUNT;
    throw thrown;
  }

  if (minor === 0n) return { kind: "blank" };

  const signedNegative = minor < 0n;
  const magnitude = signedNegative ? -minor : minor;
  if (magnitude > BigInt(Number.MAX_SAFE_INTEGER)) {
    return { kind: "error", reason: "is too large" };
  }

  // "-500 Cr" says out and in at once. Guessing which one the bank meant
  // would book the money in the wrong direction half the time.
  if (signedNegative && marked === "positive") {
    return { kind: "error", reason: "has two signs" };
  }

  const negative = signedNegative || marked === "negative";
  return { kind: "value", minor: negative ? -magnitude : magnitude };
}
