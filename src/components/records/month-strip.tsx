"use client";

import { Amount } from "@/components/shared/amount";
import { useCurrency } from "@/components/profile-provider";

/**
 * The month card, reduced to one line.
 *
 * Shown in the sticky header once the card itself has scrolled away. Records
 * is built around one number, and on a phone that number is off the top of
 * the screen after a single flick, so halfway down a long month you are
 * reading rows with nothing to measure them against.
 *
 * It carries the same three figures in the same order as the card, so this is
 * the card recognised rather than a new thing to read. Hidden from the
 * accessibility tree: it is a duplicate of a card that is still in the
 * document, and announcing the month's total twice helps nobody.
 */
export function MonthStrip({
  summary,
}: {
  summary: { income: string; expense: string; net: string };
}) {
  const net = BigInt(summary.net);
  const income = BigInt(summary.income);
  const expense = BigInt(summary.expense);
  const { decimals } = useCurrency();

  /**
   * Three exact figures do not fit on one 360px line once a month runs to
   * lakhs, and nothing here can shrink: the row used to overflow its sticky
   * header and the browser simply cut the last number off mid-digit, so a
   * ₹12,34,91,808 month rendered as "₹12,34". A clipped number is not an
   * ugly number, it is a different one.
   *
   * So past a lakh every figure is abbreviated instead. The exact three are
   * in the card this line is a condensed copy of, a flick above, and this
   * whole strip is `aria-hidden`, nothing is lost that was not already
   * said. The threshold is in major units so it holds for any currency.
   */
  const unit = 10n ** BigInt(decimals);
  const widest = [net < 0n ? -net : net, income, expense].reduce(
    (a, b) => (b > a ? b : a),
    0n,
  );
  const compact = widest / unit >= 100_000n;

  return (
    <div aria-hidden="true" className="flex items-baseline gap-3 pb-1">
      <p className="text-text-secondary shrink-0 text-xs">
        {net < 0n ? "Over by" : "Left"}
      </p>
      <p className="font-display text-xl leading-none">
        <Amount value={net < 0n ? -net : net} whole compact={compact} />
      </p>

      <p className="text-text-secondary ml-auto flex shrink-0 items-baseline gap-2 text-xs">
        <span className="text-income font-semibold">
          <Amount value={income} whole compact={compact} />
        </span>
        <span className="text-text-secondary">in</span>
        <span className="text-expense font-semibold">
          <Amount value={expense} whole compact={compact} />
        </span>
        <span className="text-text-secondary">out</span>
      </p>
    </div>
  );
}
