/**
 * What recurring expenses take, per week, month and year.
 *
 * Each rule is put on a yearly footing first (how many times it runs in a
 * year, times its amount) and the week and month are cut from that one
 * figure, so the three always agree with each other: a monthly ₹1,200 is
 * ₹14,400 a year, ₹1,200 a month and ₹276 a week, not three numbers worked
 * out three different ways.
 *
 * Expenses only, and only rules that will run again: a paused rule or one
 * whose end date has passed takes nothing. Income and transfers are not
 * deductions, so they are not counted.
 *
 * Money stays in BigInt minor units. A rule's yearly share is rounded once,
 * to the nearest paisa, before it is added in.
 */

export type SummaryRule = {
  type: string;
  /** Minor units, as text or BigInt. */
  amount: string | bigint;
  frequency: "daily" | "weekly" | "monthly" | "yearly";
  interval: number;
  /** False when paused or finished. */
  active: boolean;
  /** `dueOn` from the rule: null once it will not run again. */
  dueOn: string | null;
};

export type DeductionTotals = {
  weekly: bigint;
  monthly: bigint;
  yearly: bigint;
  /** How many rules went into the figures. */
  count: number;
};

/** Runs per year as a fraction, numerator over denominator. */
function perYear(
  frequency: SummaryRule["frequency"],
  interval: number,
): [bigint, bigint] {
  const n = BigInt(Math.max(1, Math.trunc(interval)));
  switch (frequency) {
    case "daily":
      return [365n, n];
    case "weekly":
      // 365 days over 7, rather than a flat 52: 52 weeks is 364 days, and
      // a weekly rule runs 53 times in some years.
      return [365n, 7n * n];
    case "monthly":
      return [12n, n];
    case "yearly":
      return [1n, n];
  }
}

/** a / b rounded half up, for non-negative values. */
function divRound(a: bigint, b: bigint): bigint {
  return (a * 2n + b) / (2n * b);
}

export function deductionTotals(rules: SummaryRule[]): DeductionTotals {
  let yearly = 0n;
  let count = 0;

  for (const rule of rules) {
    if (rule.type !== "expense" || !rule.active || !rule.dueOn) continue;

    const amount = typeof rule.amount === "bigint" ? rule.amount : BigInt(rule.amount);
    if (amount <= 0n) continue;

    const [num, den] = perYear(rule.frequency, rule.interval);
    yearly += divRound(amount * num, den);
    count += 1;
  }

  return {
    yearly,
    monthly: divRound(yearly, 12n),
    weekly: divRound(yearly * 7n, 365n),
    count,
  };
}
