/**
 * Money helpers.
 *
 * Money is stored as BIGINT minor units (paise/cents) everywhere, DB, server
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
  /**
   * Drop the paise, rounding down.
   *
   * For the one figure a screen is built around, where ".00" is four
   * characters of noise under a 44px number and the exact paise are in the
   * list underneath anyway. Never for a figure somebody might add up: this
   * rounds towards zero, so a column of these would not sum to the total.
   */
  whole?: boolean;
  /**
   * What to do with paise that are exactly zero.
   *
   * - `show` (default): always print them, "₹450.00".
   * - `trim`: print them only when there are some, "₹450", but "₹450.50"
   *   stays intact.
   *
   * `trim` is not the same as {@link FormatMoneyOptions.whole}: it never
   * changes the value, only whether two zeros are drawn. That is the
   * difference that lets a list hide the noise without ever rounding an
   * amount somebody might check against a receipt.
   */
  paise?: "show" | "trim";
};

/** A user's currency, as stored on their profile. */
export type CurrencySettings = {
  code: string;
  symbol: string;
  decimals: number;
};

/** The app default, used before a profile exists (CLAUDE.md: ₹ INR). */
export const DEFAULT_CURRENCY_SETTINGS: CurrencySettings = {
  code: "INR",
  symbol: DEFAULT_CURRENCY_SYMBOL,
  decimals: DEFAULT_DECIMALS,
};

/**
 * {@link formatMoney} bound to a user's currency, the form every screen
 * should use, so an amount is never rendered with somebody else's symbol.
 */
export function formatWith(
  settings: CurrencySettings,
  minor: bigint,
  options: Omit<FormatMoneyOptions, "symbol" | "decimals"> = {},
): string {
  return formatMoney(minor, {
    ...options,
    symbol: settings.symbol,
    decimals: settings.decimals,
  });
}

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
 * Like {@link toMinor} but returns `null` instead of throwing, handy inside
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
 * Converts minor units back to a plain, ungrouped decimal string, the value
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
 * An amount broken into the pieces a screen styles separately.
 *
 * The sign, the symbol, the major digits and the paise are four different
 * kinds of thing, one is arithmetic, one is a unit, one is the number you
 * came for, and one is detail, and Phase 13 asks for the last two to be set
 * back from the first. Returning parts rather than a string is what lets the
 * markup say that without any component re-deriving where the decimal point
 * fell, which is the kind of split that goes wrong on a currency with three
 * decimal places or none.
 *
 * {@link formatMoney} is these parts joined, so the plain string and the
 * rendered one can never disagree.
 */
export type MoneyParts = {
  /** "", "+" or "-". Never baked into the digits. */
  sign: string;
  /** The currency symbol, or "" when one was not asked for. */
  symbol: string;
  /** Grouped major units: "1,23,456". */
  whole: string;
  /** The decimal separator, or "" when there are no paise to draw. */
  point: string;
  /** The minor-unit digits, or "" when there are none to draw. */
  fraction: string;
};

export function moneyParts(
  minor: bigint,
  options: FormatMoneyOptions = {},
): MoneyParts {
  const {
    symbol = DEFAULT_CURRENCY_SYMBOL,
    decimals = DEFAULT_DECIMALS,
    grouping = INDIAN_GROUPING_SYMBOLS.has(symbol) ? "indian" : "western",
    signDisplay = "auto",
    whole: wholeOnly = false,
    paise = "show",
  } = options;

  assertDecimals(decimals);

  const negative = minor < 0n;
  const plain = fromMinor(negative ? -minor : minor, decimals);
  const [whole, frac] = plain.split(".");

  // `trim` only ever drops zeros. A fraction with a digit in it is part of
  // the amount, and hiding it would make the screen disagree with the
  // receipt.
  const keepFraction =
    Boolean(frac) && !wholeOnly && !(paise === "trim" && /^0+$/.test(frac));

  let sign = "";
  if (signDisplay === "always") {
    sign = negative ? "-" : "+";
  } else if (signDisplay === "auto" && negative) {
    sign = "-";
  }

  return {
    sign,
    symbol,
    whole: groupDigits(whole, grouping),
    point: keepFraction ? "." : "",
    fraction: keepFraction ? frac : "",
  };
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
  const { sign, symbol, whole, point, fraction } = moneyParts(minor, options);
  return `${sign}${symbol}${whole}${point}${fraction}`;
}

/**
 * A short form for a chart axis: ₹1.2K, ₹3.4L, ₹1.1Cr.
 *
 * An axis has about six characters to play with at 360px, and "₹1,23,456.78"
 * is twelve. The scale follows the grouping the user already reads: thousand,
 * lakh and crore for ₹, thousand/million/billion otherwise.
 *
 * Only the label shortens, every number this is given has already been
 * through BigInt arithmetic, and nothing is computed from the result.
 */
export function formatCompact(
  minor: bigint,
  options: Omit<FormatMoneyOptions, "signDisplay"> = {},
): string {
  const {
    symbol = DEFAULT_CURRENCY_SYMBOL,
    decimals = DEFAULT_DECIMALS,
    grouping = INDIAN_GROUPING_SYMBOLS.has(symbol) ? "indian" : "western",
  } = options;

  assertDecimals(decimals);

  const negative = minor < 0n;
  const abs = negative ? -minor : minor;

  const steps =
    grouping === "indian"
      ? ([
          [10n ** 7n, "Cr"],
          [10n ** 5n, "L"],
          [10n ** 3n, "K"],
        ] as const)
      : ([
          [10n ** 9n, "B"],
          [10n ** 6n, "M"],
          [10n ** 3n, "K"],
        ] as const);

  const unit = 10n ** BigInt(decimals);
  const major = abs / unit;

  // Taken from the rounded value, not the raw one: -50 paise is ₹0 once the
  // sub-unit is dropped, and "-₹0" on an axis is just wrong.
  const sign = negative && major > 0n ? "-" : "";

  for (const [threshold, suffix] of steps) {
    if (major < threshold) continue;

    // One decimal place, worked out in BigInt and trimmed: 1.0K reads as
    // noise next to 1K.
    const tenths = (major * 10n) / threshold;
    const whole = tenths / 10n;
    const rest = tenths % 10n;

    return `${sign}${symbol}${whole}${rest === 0n ? "" : `.${rest}`}${suffix}`;
  }

  // Below a thousand there is nothing to abbreviate, and the paise are noise
  // on an axis.
  return `${sign}${symbol}${groupDigits(major.toString(), grouping)}`;
}

/** `true` when the symbol groups Indian-style, exported for tests/UI copy. */
export function usesIndianGrouping(symbol: string): boolean {
  return INDIAN_GROUPING_SYMBOLS.has(symbol);
}

/**
 * Converts a BIGINT column as it arrives from PostgREST into minor units.
 *
 * supabase-js hands back `number` for a bigint column (JSON has no integer
 * type), which is exact up to 2^53, about ₹90 trillion in paise, but is
 * still a float the moment anything multiplies it. Convert at the boundary and
 * keep BigInt everywhere above it.
 *
 * @throws {MoneyParseError} when the value is not a whole number.
 */
export function fromDb(value: number | string | bigint | null): bigint {
  if (value === null) return 0n;
  if (typeof value === "bigint") return value;

  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) {
      throw new MoneyParseError(String(value));
    }
    return BigInt(value);
  }

  if (!/^-?\d+$/.test(value.trim())) {
    throw new MoneyParseError(value);
  }

  return BigInt(value.trim());
}

/**
 * The counterpart to {@link fromDb}: minor units on their way into a BIGINT
 * column. supabase-js serialises to JSON, which cannot carry a BigInt, so the
 * value has to be a number, and has to still be exact when it gets there.
 *
 * @throws {MoneyParseError} when the amount is too large to survive JSON.
 */
export function toDb(minor: bigint): number {
  const value = Number(minor);

  if (!Number.isSafeInteger(value)) {
    throw new MoneyParseError(minor.toString());
  }

  return value;
}

/**
 * The nearest number somebody would actually choose.
 *
 * A budget suggested as ₹7,842 looks like arithmetic; ₹8,000 looks like a
 * decision. Rounds up, a limit set below what was spent last month is a
 * limit that is already broken, to the nearest 500 under ₹10,000, the
 * nearest 1,000 under ₹1,00,000, and the nearest 5,000 above that.
 */
export function friendlyAmount(minor: bigint, decimals: number): bigint {
  if (minor <= 0n) return 0n;

  const unit = 10n ** BigInt(decimals);

  // Rounded up, not truncated: a spend of one paisa divides to zero whole
  // rupees, and a suggestion of ₹0 is below what was already spent, which
  // is the one thing this must never produce.
  const whole = (minor + unit - 1n) / unit;

  const step = whole < 10_000n ? 500n : whole < 100_000n ? 1_000n : 5_000n;

  const rounded = ((whole + step - 1n) / step) * step;
  return rounded * unit;
}

/**
 * The sign as it is drawn on screen.
 *
 * `moneyParts` writes "-", which is right for strings that leave the app.
 * On screen the hyphen is narrower and sits lower than "+", so a day total
 * in hyphens beside rows in minus signs read as two different things. The
 * PDF keeps the hyphen: its font is not guaranteed to have U+2212.
 */
export function signGlyph(sign: string): string {
  return sign === "-" ? "−" : sign;
}
