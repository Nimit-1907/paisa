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
  | {
      kind: "value";
      minor: bigint;
      /**
       * A trailing Dr, Cr or minus said which way the money went. Such a
       * value is not subject to the file's sign convention: the bank has
       * already said what it means.
       */
      marked: boolean;
    }
  | { kind: "blank" }
  | { kind: "error"; reason: string };

const NOT_AN_AMOUNT: AmountText = { kind: "error", reason: "is not an amount" };

/** A `.` or `,` with a digit on both sides: a separator inside the number. */
const SEPARATOR = /(?<=\d)[.,](?=\d)/g;

/** Every point in `text` sits before exactly three digits: thousands. */
const pointsAreGrouping = (text: string) =>
  !/(?<=\d)\.(?!\d{3}(?!\d))/.test(text);

/**
 * The number with a point as its decimal mark and no other separator but
 * grouping commas, which `toMinor` reads; or null when it cannot be sure.
 *
 * The decimal mark is the last separator. It is a comma when the file is
 * `;`-separated (a comma-decimal locale wrote it), or when that comma has
 * only one or two digits after it: "12,50" and "1.234,56". A comma before
 * three digits is grouping ("1,234"), as is one before a point
 * ("1,234.56"). Anything that mixes the two ways ("1,234,5", "1.23,45") is
 * refused rather than read one way or the other.
 */
function normaliseSeparators(body: string, decimalComma: boolean): string | null {
  const last = [...body.matchAll(SEPARATOR)].at(-1);
  if (!last || last.index === undefined) return body;

  const head = body.slice(0, last.index);
  const tail = body.slice(last.index + 1);
  const digitsAfter = /^\d+/.exec(tail)?.[0].length ?? 0;

  if (last[0] === "," && (decimalComma || digitsAfter <= 2)) {
    if (/(?<=\d),(?=\d)/.test(head) || !pointsAreGrouping(head)) return null;
    return `${head.replace(/(?<=\d)[.\s](?=\d)/g, "")}.${tail}`;
  }

  if (decimalComma) {
    // The last separator is a point in a comma-decimal file, so every
    // separator is grouping: "1.234" is a thousand and more, "12.50" is
    // not a number this locale writes.
    if (body.match(SEPARATOR)?.includes(",") || !pointsAreGrouping(body)) {
      return null;
    }
    return body.replace(/(?<=\d)\.(?=\d)/g, "");
  }

  // A point last: the ordinary way round. Commas before it are grouping,
  // and a second point is refused by `toMinor`.
  return last[0] === "." && /(?<=\d)\.(?=\d)/.test(head) ? null : body;
}

export function readAmount(
  text: string,
  decimals: number,
  {
    decimalComma = false,
  }: {
    /** The file is `;`-separated, so its decimal mark is a comma. */
    decimalComma?: boolean;
  } = {},
): AmountText {
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

  const normalised = normaliseSeparators(body, decimalComma);
  if (normalised === null) return NOT_AN_AMOUNT;
  body = normalised;

  // Places past the currency's are refused unless they are only zeros:
  // "10.5000" is ₹10.50, "10.555" is a figure Paisa cannot store exactly,
  // and rounding it would book a different amount from the statement's.
  // After normalising, the one point between digits is the decimal mark.
  const fraction = /(?<=\d)\.(\d+)/.exec(body)?.[1] ?? "";
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
  return {
    kind: "value",
    minor: negative ? -magnitude : magnitude,
    marked: marked !== null,
  };
}
