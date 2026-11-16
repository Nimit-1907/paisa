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
  {
    allowNegative = false,
    replace = false,
  }: {
    allowNegative?: boolean;
    /**
     * The amount was filled in for the person (a quick-add chip), so the
     * first key starts a new one rather than adding to it, the way typing
     * over selected text does. Without it, "250" and a 7 is "2507".
     */
    replace?: boolean;
  } = {},
): string {
  if (replace && key !== "sign") {
    return key === "back" || key === "clear" ? "" : pressKey("", key, decimals);
  }

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

/**
 * The keypad key a physical key stands for, or null to leave it alone.
 *
 * The amount field routes these through `pressKey` rather than letting the
 * browser edit the hidden input: the caret in a field nobody can see sits
 * wherever a tap left it, and a 7 typed in front of "250" books ₹7,250.
 */
export function amountKeyFor(key: string): AmountKey | null {
  if (/^[0-9]$/.test(key)) return key as AmountKey;
  if (key === ".") return ".";
  if (key === "Backspace") return "back";
  if (key === "Delete") return "clear";
  return null;
}

/**
 * Minor units as the text an amount field holds: "250", "250.5", "250.05".
 *
 * No zero paise padded on. "250.00" already has both its places, so the
 * keypad would refuse every digit pressed after it.
 */
export function minorToAmountText(
  minor: string | bigint,
  decimals: number,
  {
    keepSign = false,
  }: {
    /** For an amount that can be below zero, an opening balance. */
    keepSign?: boolean;
  } = {},
): string {
  const value = BigInt(minor);
  const abs = value < 0n ? -value : value;
  const sign = keepSign && value < 0n ? "-" : "";

  if (decimals === 0) return `${sign}${abs}`;

  const factor = 10n ** BigInt(decimals);
  const whole = abs / factor;
  const fraction = (abs % factor)
    .toString()
    .padStart(decimals, "0")
    .replace(/0+$/, "");

  return `${sign}${fraction ? `${whole}.${fraction}` : whole}`;
}

/**
 * An amount being typed, with its grouping commas: "12302" reads "12,302".
 *
 * The text itself stays ungrouped; this is only how the figure is drawn.
 * `indian` groups in lakhs and crores (12,34,567), as the rest of the app
 * does for the rupee.
 */
export function groupAmountText(text: string, indian: boolean): string {
  const point = text.indexOf(".");
  const whole = point === -1 ? text : text.slice(0, point);
  const rest = point === -1 ? "" : text.slice(point);

  if (whole.length <= 3) return text;

  const last = whole.slice(-3);
  const head = whole.slice(0, -3);
  const size = indian ? 2 : 3;
  const groups: string[] = [];

  for (let end = head.length; end > 0; end -= size) {
    groups.unshift(head.slice(Math.max(0, end - size), end));
  }

  return `${[...groups, last].join(",")}${rest}`;
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
