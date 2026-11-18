import "server-only";

import { fromDb } from "@/lib/money";
import {
  bucketFor,
  comparablePeriod,
  type Period,
  periodLength,
  previousPeriod,
  shortRange,
} from "@/lib/period";
import { dayDifference } from "@/lib/recurrence";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export type CategorySlice = {
  categoryId: string;
  name: string;
  icon: string | null;
  /** Kept while the old column exists; nothing reads it since Phase 14. */
  /** One of the eight tint keys, the donut slice and the legend tile. */
  tint: string | null;
  /** Minor units as text, an RSC payload cannot carry a BigInt. */
  total: string;
};

export type SeriesPoint = {
  /** `yyyy-mm-dd`: the first day of the bucket. */
  on: string;
  income: string;
  expense: string;
};

export type BalancePoint = {
  on: string;
  balance: string;
};

export type AnalysisData = {
  bucket: "day" | "month";
  categories: CategorySlice[];
  series: SeriesPoint[];
  balances: BalancePoint[];
  /** The selected kind's total across the period. */
  total: string;
  /**
   * The same total for the period before, for the change card. While the
   * period is running, only as many days of it as have passed of this one.
   */
  previousTotal: string;
  /** What the change card compares with: "1–18 Oct", "Oct", "2025". */
  previousLabel: string;
  /** Whether the comparison was cut short to match a running period. */
  previousPartial: boolean;
  /** Income and expense across the whole period, for the bar chart's legend. */
  incomeTotal: string;
  expenseTotal: string;
  /** Busiest bucket by the selected kind, or null when nothing was spent. */
  peak: { on: string; amount: string } | null;
  /**
   * The top category's total in the period before, for the one sentence that
   * leads the screen. Null when it had none.
   */
  topPrevious: string | null;
  /** Days in the period. */
  days: number;
  /**
   * Days of it that have actually happened, which is what an average should
   * divide by: on the 14th, November's spending is spread over 14 days, not
   * over 30.
   */
  daysElapsed: number;
};

export type AnalysisKind = Database["public"]["Enums"]["category_kind"];

/**
 * Everything the Analysis screen draws, for one period.
 *
 * Four reads in parallel, all of them grouped in the database. Pulling the
 * rows back to add them up here would mean a year of records crossing the
 * wire to produce twelve numbers.
 *
 * The previous period is fetched for one figure, the change card, so it
 * asks only for the totals, not the breakdown.
 */
export async function getAnalysis({
  period,
  kind,
  accountId,
  today,
}: {
  period: Period;
  kind: AnalysisKind;
  /** Null means every account that counts towards the total. */
  accountId: string | null;
  /** Today where the user is, `yyyy-mm-dd`. */
  today: string;
}): Promise<AnalysisData> {
  const supabase = await createClient();
  const bucket = bucketFor(period);
  const before = comparablePeriod(period, today);

  const [categories, series, balances, previousCategories, previous] =
    await Promise.all([
      supabase.rpc("category_totals", {
        p_from: period.from,
        p_to: period.to,
        p_kind: kind,
      }),
      supabase.rpc("period_series", {
        p_from: period.from,
        p_to: period.to,
        p_bucket: bucket,
      }),
      supabase.rpc("balance_series", {
        p_from: period.from,
        p_to: period.to,
        p_bucket: bucket,
        // Omitted rather than null: the argument has a default, and the
        // generated type says so.
        p_account_id: accountId ?? undefined,
      }),
      // The same breakdown for the period before, so the headline can say what
      // changed rather than only what is.
      supabase.rpc("category_totals", {
        p_from: before.from,
        p_to: before.to,
        p_kind: kind,
      }),
      supabase.rpc("period_series", {
        p_from: before.from,
        p_to: before.to,
        // One bucket's worth of arithmetic is all the change card needs, and a
        // year of daily rows to produce one number is a waste of a query.
        // The bucket only decides the grouping; the rows are filtered by the
        // range either way, so one bucket a month is the cheapest way to get a
        // total that is exactly the same number.
        p_bucket: "month",
      }),
    ]);

  if (categories.error) throw new Error(categories.error.message);
  if (previousCategories.error) {
    throw new Error(previousCategories.error.message);
  }
  if (series.error) throw new Error(series.error.message);
  if (balances.error) throw new Error(balances.error.message);
  if (previous.error) throw new Error(previous.error.message);

  const slices: CategorySlice[] = categories.data.map((row) => ({
    categoryId: row.category_id,
    name: row.name,
    icon: row.icon,
    // The generator types a domain column as `unknown`.
    tint: (row.tint as string | null) ?? null,
    total: fromDb(row.total).toString(),
  }));

  let incomeTotal = 0n;
  let expenseTotal = 0n;
  let peak: { on: string; amount: bigint } | null = null;

  const points: SeriesPoint[] = series.data.map((row) => {
    const income = fromDb(row.income);
    const expense = fromDb(row.expense);

    incomeTotal += income;
    expenseTotal += expense;

    const selected = kind === "income" ? income : expense;
    if (selected > 0n && (!peak || selected > peak.amount)) {
      peak = { on: row.bucket_start, amount: selected };
    }

    return {
      on: row.bucket_start,
      income: income.toString(),
      expense: expense.toString(),
    };
  });

  let previousTotal = 0n;
  for (const row of previous.data) {
    previousTotal += fromDb(kind === "income" ? row.income : row.expense);
  }

  const total = kind === "income" ? incomeTotal : expenseTotal;
  const busiest = peak as { on: string; amount: bigint } | null;

  const topName = slices[0]?.name;
  const topBefore = topName
    ? previousCategories.data.find((row) => row.name === topName)
    : undefined;

  return {
    bucket,
    categories: slices,
    series: points,
    balances: balances.data.map((row) => ({
      on: row.bucket_start,
      balance: fromDb(row.balance).toString(),
    })),
    total: total.toString(),
    previousTotal: previousTotal.toString(),
    previousLabel: shortRange(before),
    previousPartial: before.to !== previousPeriod(period).to,
    incomeTotal: incomeTotal.toString(),
    expenseTotal: expenseTotal.toString(),
    peak: busiest
      ? { on: busiest.on, amount: busiest.amount.toString() }
      : null,
    topPrevious: topBefore ? fromDb(topBefore.total).toString() : null,
    days: periodLength(period),
    daysElapsed: elapsedDays(period, today),
  };
}

/**
 * How much of the period is behind us.
 *
 * A period in the past is over, so all of it counts; one that has not started
 * contributes nothing; the one we are in counts up to today.
 */
function elapsedDays(period: Period, today: string): number {
  if (today > period.to) return periodLength(period);
  if (today < period.from) return 0;

  return dayDifference(period.from, today) + 1;
}

/** The accounts the balance line may be narrowed to. */
export async function getBalanceAccounts() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("accounts")
    .select("id, name, icon, tint")
    .eq("archived", false)
    .order("sort_order", { ascending: true });

  if (error) throw new Error(error.message);
  return data;
}
