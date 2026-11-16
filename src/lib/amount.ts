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
): string {
  const kept = text.replace(/[^\d.]/g, "");
  const point = kept.indexOf(".");
  const cleaned =
    point === -1
      ? kept
      : `${kept.slice(0, point)}.${kept.slice(point + 1).replace(/\./g, "")}`;

  const places = point === -1 ? 0 : cleaned.length - point - 1;
  const tooMany = decimals === 0 ? point !== -1 : places > decimals;
  const oneKeystroke = cleaned.length === previous.length + 1;

  return tooMany && oneKeystroke ? previous : cleaned;
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
