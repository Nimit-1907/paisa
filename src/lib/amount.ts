/**
 * The amount field takes an amount: digits, and one decimal point with at
 * most the currency's number of places after it. Nothing else.
 *
 * It used to take a sum ("120+45") and work it out. That made a typo like
 * "450-" a question about arithmetic rather than a wrong key, and the iOS
 * decimal pad never had the operators anyway.
 */

export type AmountResult =
  { ok: true; minor: bigint } | { ok: false; error: string };

/**
 * What the field keeps of what was typed or pasted.
 *
 * Grouping commas and spaces from a paste are dropped, anything that is not
 * a digit or a point is refused, and a second point is ignored.
 *
 * One place too many is refused as it is typed: with `previous`, a single
 * keystroke that would make "10.99" into "10.999" leaves "10.99". A paste
 * with too many places is kept whole instead, so `parseAmount` says so,
 * rather than quietly booking a different amount from the one pasted.
 */
export function cleanAmount(
  text: string,
  decimals: number,
  previous = "",
  { allowNegative = false }: { allowNegative?: boolean } = {},
): string {
  // A leading minus is kept only where a negative makes sense, an opening
  // balance on a credit card; a record's amount has its sign in its type.
  const negative = allowNegative && /^\s*[-\u2212]/.test(text);
  const kept = text.replace(/[^\d.]/g, "");
  const point = kept.indexOf(".");
  const body =
    point === -1
      ? kept
      : `${kept.slice(0, point)}.${kept.slice(point + 1).replace(/\./g, "")}`;
  const cleaned = negative ? `-${body}` : body;

  const places = point === -1 ? 0 : body.length - point - 1;
  const tooMany = decimals === 0 ? point !== -1 : places > decimals;
  const oneKeystroke = cleaned.length === previous.length + 1;

  return tooMany && oneKeystroke ? previous : cleaned;
}

/** A key on the in-app keypad. */
export type AmountKey =
  | "0"
  | "1"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "."
  | "back"
  | "clear"
  | "sign";

/** Whole-number digits the keypad will take: ten trillion is plenty. */
const MAX_WHOLE_DIGITS = 13;

/**
 * What the amount becomes when a key on the keypad is pressed.
 *
 * The keypad cannot type an amount that does not parse: one point, no
 * places past the currency's, no leading zeros ("007" is "7"), and a point
 * pressed first reads "0.". A key that would break one of those does
 * nothing, which on a keypad is the expected answer to a wrong key.
 */
export function pressKey(
  value: string,
  key: AmountKey,
  decimals: number,
  { allowNegative = false }: { allowNegative?: boolean } = {},
): string {
  const negative = value.startsWith("-");
  const body = negative ? value.slice(1) : value;
  const sign = (next: string) => (negative ? `-${next}` : next);

  switch (key) {
    case "clear":
      return "";
    case "back": {
      const next = body.slice(0, -1);
      return next === "" ? "" : sign(next);
    }
    case "sign":
      if (!allowNegative) return value;
      return negative ? body : `-${body}`;
    case ".":
      if (decimals === 0 || body.includes(".")) return value;
      return sign(`${body === "" ? "0" : body}.`);
    default: {
      const [whole = "", fraction] = body.split(".");
      if (fraction !== undefined) {
        return fraction.length >= decimals ? value : sign(`${body}${key}`);
      }
      if (whole === "0") return sign(key);
      if (whole.length >= MAX_WHOLE_DIGITS) return value;
      return sign(`${whole}${key}`);
    }
  }
}

/** "1234.5" into minor units, or why not. Never a sum. */
export function parseAmount(text: string, decimals: number): AmountResult {
  const trimmed = text.trim();

  if (trimmed === "") return { ok: false, error: "Enter an amount." };

  const pattern =
    decimals === 0
      ? /^\d+$/
      : new RegExp(`^(\\d+\\.?\\d{0,${decimals}}|\\.\\d{1,${decimals}})$`);

  const point = trimmed.indexOf(".");
  if (/^\d*\.?\d*$/.test(trimmed) && point !== -1) {
    const places = trimmed.length - point - 1;
    if (decimals === 0) {
      return { ok: false, error: "This currency has no decimal places." };
    }
    if (places > decimals) {
      return {
        ok: false,
        error: `Use at most ${decimals} decimal places.`,
      };
    }
  }

  if (!pattern.test(trimmed)) {
    return { ok: false, error: "Use digits only, like 450 or 450.50." };
  }

  const [whole = "", fraction = ""] = trimmed.split(".");
  const minor =
    BigInt(whole || "0") * 10n ** BigInt(decimals) +
    BigInt(fraction.padEnd(decimals, "0") || "0");

  // Past this it stops surviving JSON as a number on the way to the client.
  if (minor > BigInt(Number.MAX_SAFE_INTEGER)) {
    return { ok: false, error: "That amount is too large." };
  }

  return { ok: true, minor };
}
