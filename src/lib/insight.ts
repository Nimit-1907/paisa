import type { PeriodKind } from "@/lib/period";

/**
 * The one sentence worth reading before any chart.
 *
 * A donut tells you the shape of a month; it does not tell you what changed,
 * which is the thing a person actually came to find out. This says it in
 * words, from the same numbers the charts are drawn from.
 *
 * Pure, so it can be tested: a sentence that quietly says "18% higher" when
 * it was lower is worse than no sentence.
 */

export type InsightInput = {
  kind: "expense" | "income";
  periodKind: PeriodKind;
  /** Biggest category this period, or null when nothing was recorded. */
  top: { name: string; total: bigint } | null;
  /** The same category's total in the period before, if it had one. */
  topPrevious: bigint | null;
  /** Everything of this kind, this period. */
  total: bigint;
};

const WHEN: Record<PeriodKind, string> = {
  week: "this week",
  month: "this month",
  year: "this year",
  custom: "in this range",
};

const BEFORE: Record<PeriodKind, string> = {
  week: "last week",
  month: "last month",
  year: "last year",
  custom: "the period before",
};

/** Percentage change, rounded, worked out in BigInt. */
function changePercent(now: bigint, before: bigint): number | null {
  if (before <= 0n) return null;

  const scaled = ((now - before) * 1000n) / before;
  return Math.round(Number(scaled) / 10);
}

/** A share of the total, rounded, worked out in BigInt. */
function sharePercent(part: bigint, whole: bigint): number {
  if (whole <= 0n) return 0;
  return Math.round(Number((part * 1000n) / whole) / 10);
}

export function describeInsight(input: InsightInput): string | null {
  const { top, periodKind, kind } = input;
  if (!top || top.total <= 0n) return null;

  const noun = kind === "income" ? "source of income" : "biggest expense";
  const opening = `${top.name} is your ${noun} ${WHEN[periodKind]}`;

  const change =
    input.topPrevious === null
      ? null
      : changePercent(top.total, input.topPrevious);

  // A change worth mentioning. Under 5% either way is noise, and reporting
  // it as news would teach the reader to stop believing the sentence.
  if (change !== null && Math.abs(change) >= 5) {
    const direction = change > 0 ? "higher" : "lower";
    return `${opening}, ${Math.abs(change)}% ${direction} than ${BEFORE[periodKind]}.`;
  }

  if (change !== null) {
    return `${opening}, about the same as ${BEFORE[periodKind]}.`;
  }

  const share = sharePercent(top.total, input.total);
  return `${opening}, ${share}% of the total.`;
}
