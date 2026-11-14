/**
 * Money helpers.
 *
 * Money is stored as BIGINT minor units (paise/cents) everywhere — DB, server
 * actions, props. Floats never touch an amount: parsing and formatting are
 * pure string/BigInt arithmetic, so 0.1 + 0.2 problems cannot happen.
 *
 * Only format at the edge, right before rendering.
 */

/** Minor units per major unit for most currencies (₹1 = 100 paise). */
export const DEFAULT_DECIMALS = 2;

/** Default currency for new users (CLAUDE.md: ₹ INR, user-changeable). */
export const DEFAULT_CURRENCY_SYMBOL = "₹";

/** Currency symbols that use the Indian 2-2-3 grouping (₹1,23,456.78). */
const INDIAN_GROUPING_SYMBOLS = new Set(["₹", "Rs", "Rs.", "INR", "₨"]);

export type Grouping = "indian" | "western" | "none";

export type FormatMoneyOptions = {
  /** Currency symbol to prefix. Defaults to ₹. Pass "" for a bare number. */
  symbol?: string;
  /** Minor-unit exponent. Defaults to 2. */
  decimals?: number;
  /** Digit grouping. Defaults to Indian for ₹/INR, Western otherwise. */
  grouping?: Grouping;
  /**
   * - `auto` (default): "-" only for negatives
   * - `always`: "+" / "-" (used for income vs expense rows)
   * - `never`: magnitude only (the UI colours the sign instead)
   */
  signDisplay?: "auto" | "always" | "never";
};

/** Thrown by {@link toMinor} when a string is not a usable amount. */
export class MoneyParseError extends Error {
  constructor(input: string) {
    super(`Not a valid amount: ${JSON.stringify(input)}`);
    this.name = "MoneyParseError";
  }
}

function assertDecimals(decimals: number): void {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 8) {
    throw new RangeError(`decimals must be an integer 0–8, got ${decimals}`);
  }
}

function pow10(exponent: number): bigint {
  return 10n ** BigInt(exponent);
}

/**
 * Parses a user-typed amount into minor units.
 *
 * Accepts what a numeric keypad and a paste from anywhere realistically
 * produce: "1234.5", "₹ 1,23,456.78", a leading "+"/"-", a Unicode minus,
 * accounting parentheses ("(500)" → -50000n), and ".5" / "5." shorthands.
 * `,` and whitespace are grouping separators and `.` is the decimal separator
 * (so "1,234.50" and "1 234.50" parse; European "1.234,50" does not).
 *
 * Extra decimals are rounded half-away-from-zero: toMinor("1.005") → 101n.
 *
 * @throws {MoneyParseError} when the string holds no digits or is malformed.
 */
export function toMinor(
  input: string,
  decimals: number = DEFAULT_DECIMALS,
): bigint {
  assertDecimals(decimals);

  const raw = String(input ?? "");
  // Normalise Unicode minus/dashes, then strip whitespace (incl. NBSP).
  let s = raw.replace(/[\u2212\u2013\u2014]/g, "-").replace(/[\s\u00a0]/g, "");

  // Drop a currency word at either end, with the abbreviation dot it may
  // carry, so the "." in "Rs.250" is not read as a decimal separator. Only
  // "Rs"/"Rs." and three-letter codes ("INR250", "250 USD") count, and any
  // letter left over is an error rather than something to delete: stripping
  // letters wholesale would silently turn "1e5" into 15 and "0x10" into 10.
  s = s
    .replace(/^(?:rs\.?|[A-Za-z]{3}\.?)/i, "")
    .replace(/(?:rs\.?|[A-Za-z]{3}\.?)$/i, "");

  if (/[A-Za-z]/.test(s)) {
    throw new MoneyParseError(raw);
  }

  let negative = false;

  // Accounting notation: (500) means -500.
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }

  // A sign may sit before the symbol ("-₹5") or after it ("₹-5"), but it must
  // come before the first digit and appear at most once.
  const minusCount = (s.match(/-/g) ?? []).length;
  if (minusCount > 0) {
    const firstDigit = s.search(/\d/);
    if (minusCount > 1 || firstDigit === -1 || s.indexOf("-") > firstDigit) {
      throw new MoneyParseError(raw);
    }
    negative = true;
  }

  // Drop the sign (captured above), a currency symbol at either end and the
  // grouping commas. Anything else left over fails the check below instead of
  // being deleted, so "1@00" is an error rather than 100.
  s = s
    .replace(/[-+]/g, "")
    .replace(/^[₹$€£¥₨]+|[₹$€£¥₨]+$/g, "")
    .replace(/,/g, "");

  if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(s)) {
    throw new MoneyParseError(raw);
  }

  const [intPart = "", fracPart = ""] = s.split(".");

  const scale = pow10(decimals);
  const kept = fracPart.slice(0, decimals).padEnd(decimals, "0");
  const dropped = fracPart.slice(decimals);

  let minor =
    BigInt(intPart === "" ? "0" : intPart) * scale +
    BigInt(kept === "" ? "0" : kept);

  // Round half-away-from-zero on the first dropped digit.
  if (dropped.length > 0 && dropped.charCodeAt(0) >= "5".charCodeAt(0)) {
    minor += 1n;
  }

  return negative ? -minor : minor;
}

/**
 * Like {@link toMinor} but returns `null` instead of throwing — handy inside
 * zod schemas and controlled inputs.
 */
export function tryToMinor(
  input: string,
  decimals: number = DEFAULT_DECIMALS,
): bigint | null {
  try {
    return toMinor(input, decimals);
  } catch {
    return null;
  }
}

/**
 * Converts minor units back to a plain, ungrouped decimal string — the value
 * to put in an `<input inputMode="decimal">`.
 *
 * fromMinor(123450n) → "1234.50"
 */
export function fromMinor(
  minor: bigint,
  decimals: number = DEFAULT_DECIMALS,
): string {
  assertDecimals(decimals);

  const negative = minor < 0n;
  const abs = negative ? -minor : minor;

  if (decimals === 0) {
    return `${negative ? "-" : ""}${abs.toString()}`;
  }

  const scale = pow10(decimals);
  const whole = abs / scale;
  const frac = (abs % scale).toString().padStart(decimals, "0");

  return `${negative ? "-" : ""}${whole.toString()}.${frac}`;
}

/** Groups a digit string Indian-style: last 3 digits, then pairs. */
function groupIndian(digits: string): string {
  if (digits.length <= 3) return digits;

  const last3 = digits.slice(-3);
  const rest = digits.slice(0, -3);
  const pairs = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",");

  return `${pairs},${last3}`;
}

/** Groups a digit string Western-style: thousands. */
function groupWestern(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function groupDigits(digits: string, grouping: Grouping): string {
  if (grouping === "none") return digits;
  return grouping === "indian" ? groupIndian(digits) : groupWestern(digits);
}

/**
 * Formats minor units for display.
 *
 * formatMoney(12345678n)                       → "₹1,23,456.78"
 * formatMoney(12345678n, { symbol: "$" })      → "$123,456.78"
 * formatMoney(-50000n, { signDisplay: "never" })→ "₹500.00"
 */
export function formatMoney(
  minor: bigint,
  options: FormatMoneyOptions = {},
): string {
  const {
    symbol = DEFAULT_CURRENCY_SYMBOL,
    decimals = DEFAULT_DECIMALS,
    grouping = INDIAN_GROUPING_SYMBOLS.has(symbol) ? "indian" : "western",
    signDisplay = "auto",
  } = options;

  assertDecimals(decimals);

  const negative = minor < 0n;
  const plain = fromMinor(negative ? -minor : minor, decimals);
  const [whole, frac] = plain.split(".");

  const body = frac
    ? `${groupDigits(whole, grouping)}.${frac}`
    : groupDigits(whole, grouping);

  let sign = "";
  if (signDisplay === "always") {
    sign = negative ? "-" : "+";
  } else if (signDisplay === "auto" && negative) {
    sign = "-";
  }

  return `${sign}${symbol}${body}`;
}

/** `true` when the symbol groups Indian-style — exported for tests/UI copy. */
export function usesIndianGrouping(symbol: string): boolean {
  return INDIAN_GROUPING_SYMBOLS.has(symbol);
}
