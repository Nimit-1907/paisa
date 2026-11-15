"use client";

import { Amount } from "@/components/shared/amount";

/**
 * The month card, reduced to one line.
 *
 * Shown in the sticky header once the card itself has scrolled away. Records
 * is built around one number, and on a phone that number is off the top of
 * the screen after a single flick — so halfway down a long month you are
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

  return (
    <div aria-hidden="true" className="flex items-baseline gap-3 pb-1">
      <p className="text-ink-2 text-label shrink-0 font-semibold tracking-wide uppercase">
        {net < 0n ? "Over by" : "Left"}
      </p>
      <p className="font-display text-xl leading-none">
        <Amount value={net < 0n ? -net : net} whole />
      </p>

      <p className="text-ink-2 ml-auto flex shrink-0 items-baseline gap-2 text-xs">
        <span className="text-income font-semibold">
          <Amount value={BigInt(summary.income)} whole />
        </span>
        <span className="text-ink-3">in</span>
        <span className="text-expense font-semibold">
          <Amount value={BigInt(summary.expense)} whole />
        </span>
        <span className="text-ink-3">out</span>
      </p>
    </div>
  );
}
