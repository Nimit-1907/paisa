"use client";

import * as React from "react";

import { useCurrency, useShowPaise } from "@/components/profile-provider";
import {
  type FormatMoneyOptions,
  formatCompact,
  formatMoney,
  moneyParts,
} from "@/lib/money";
import { cn } from "@/lib/utils";

/** Which colour the figure carries. `inherit` leaves it to the parent. */
export type AmountTone =
  "inherit" | "ink" | "ink-2" | "income" | "expense" | "transfer" | "warning";

const TONES: Record<AmountTone, string> = {
  inherit: "",
  ink: "text-text",
  "ink-2": "text-text-secondary",
  income: "text-income",
  expense: "text-expense",
  transfer: "text-transfer",
  warning: "text-text",
};

type AmountProps = {
  value: bigint;
  tone?: AmountTone;
  /**
   * Whether to draw paise that are exactly zero.
   *
   * `preference` (the default) follows the user's "Show paise in lists"
   * setting. A screen that must be exact — the edit sheet, a record's own
   * detail — passes `show` and ignores the setting.
   */
  paise?: "show" | "trim" | "preference";
  signDisplay?: FormatMoneyOptions["signDisplay"];
  /** Drop the paise entirely. For a hero figure only; see money.ts. */
  whole?: boolean;
  /**
   * Abbreviate: ₹1.2L, ₹45K.
   *
   * For somewhere there is genuinely no room — a chart axis, a stat tile at
   * 360px. The exact figure stays available to a screen reader, and
   * {@link AmountProps.revealable} offers it to a thumb as well.
   */
  compact?: boolean;
  /** With `compact`, tapping swaps to the full figure. */
  revealable?: boolean;
  className?: string;
};

/**
 * An amount, set the way this app sets amounts.
 *
 * Three pieces, three weights: the digits you came for, then the currency
 * symbol a size down, then the paise smaller again. The hierarchy is carried
 * by size and weight rather than by colour, because opacity over the money
 * palette measures 3.0–3.6:1 in light mode against the 4.5 small text needs —
 * so the obvious "lighter" (a dimmer colour) would have made the decimals the
 * one thing on screen that fails AA. The neutral tone does step the paise
 * down to `ink-2`, which is measured at 6.25:1 or better on every surface.
 *
 * The visible parts are hidden from the accessibility tree and the full
 * figure is given once as text, so an abbreviated or paise-trimmed amount is
 * still read out in full and never read as four separate numbers.
 */
export function Amount({
  value,
  tone = "inherit",
  paise = "preference",
  signDisplay,
  whole,
  compact = false,
  revealable = false,
  className,
}: AmountProps) {
  const currency = useCurrency();
  const showPaise = useShowPaise();
  const [revealed, setRevealed] = React.useState(false);

  const options: FormatMoneyOptions = {
    symbol: currency.symbol,
    decimals: currency.decimals,
    signDisplay,
    whole,
    paise: paise === "preference" ? (showPaise ? "show" : "trim") : paise,
  };

  // Always the exact figure, paise and all: this is what gets read out and
  // what a tap reveals, so it must not inherit any of the trimming above.
  const exact = formatMoney(value, {
    ...options,
    whole: false,
    paise: "show",
  });

  const abbreviated = compact && !revealed;

  const body = abbreviated ? (
    <span aria-hidden="true">{formatCompact(value, options)}</span>
  ) : (
    // Only a neutral figure can afford a colour step on the paise. On a
    // coloured one, `ink-2` would read as a third money colour.
    <Parts value={value} options={options} dimMinor={tone === "ink"} />
  );

  const content = (
    <span className={cn("amount", TONES[tone], className)}>
      {body}
      <span className="sr-only">{exact}</span>
    </span>
  );

  if (!compact || !revealable) return content;

  return (
    <button
      type="button"
      onClick={() => setRevealed((shown) => !shown)}
      aria-label={revealed ? `${exact}. Shorten` : `${exact}. Show in full`}
      className=" rounded-control "
    >
      {content}
    </button>
  );
}

/** The four pieces, each at its own size and weight. */
function Parts({
  value,
  options,
  dimMinor,
}: {
  value: bigint;
  options: FormatMoneyOptions;
  dimMinor: boolean;
}) {
  const { sign, symbol, whole, point, fraction } = moneyParts(value, options);

  return (
    <span aria-hidden="true">
      {sign}
      <span className="amount-unit">{symbol}</span>
      {whole}
      {fraction ? (
        <span className={cn("amount-minor", dimMinor && "text-text-secondary")}>
          {point}
          {fraction}
        </span>
      ) : null}
    </span>
  );
}
