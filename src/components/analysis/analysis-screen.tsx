"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { ChartPie } from "lucide-react";

import {
  type BalanceAccount,
  BalanceLine,
} from "@/components/analysis/balance-line";
import { CategoryDonut } from "@/components/analysis/category-donut";
import { PeriodBars } from "@/components/analysis/period-bars";
import { PeriodSelector } from "@/components/analysis/period-selector";
import { SummaryCards } from "@/components/analysis/summary-cards";
import { EmptyState } from "@/components/shared/empty-state";
import { AddRecordButton } from "@/components/records/add-record-button";
import { describeInsight } from "@/lib/insight";
import type { Period } from "@/lib/period";
import type { AnalysisData } from "@/lib/queries/analysis";
import { cn } from "@/lib/utils";

/**
 * The Analysis tab.
 *
 * Everything on it is a view of one period and one side of the ledger, both
 * of which live in the URL. The numbers come from the same rows Records
 * lists, grouped in the database rather than re-added here.
 */
export function AnalysisScreen({
  period,
  kind,
  data,
  accounts,
  accountId,
  today,
  weekStart,
}: {
  period: Period;
  kind: "income" | "expense";
  data: AnalysisData;
  accounts: BalanceAccount[];
  accountId: string | null;
  today: string;
  weekStart: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function chooseKind(next: "income" | "expense") {
    const search = new URLSearchParams(params.toString());
    search.set("t", next);
    router.replace(`${pathname}?${search.toString()}`, { scroll: false });
  }

  /**
   * Records, filtered to one category over the same dates.
   *
   * `m` puts Records on the month the period starts in and `from`/`to` carry
   * the exact window, so a week in the middle of a month lands on precisely
   * the records the slice was drawn from.
   */
  function recordsHref(categoryId: string) {
    const search = new URLSearchParams({
      m: period.from.slice(0, 7),
      category: categoryId,
      type: kind,
      from: period.from,
      to: period.to,
    });

    return `/records?${search.toString()}`;
  }

  // The headline: what changed, in words, before any chart asks to be read.
  const insight = describeInsight({
    kind,
    periodKind: period.kind,
    top: data.categories[0]
      ? {
          name: data.categories[0].name,
          total: BigInt(data.categories[0].total),
        }
      : null,
    topPrevious: data.topPrevious === null ? null : BigInt(data.topPrevious),
    total: BigInt(data.total),
  });

  const nothing =
    data.categories.length === 0 &&
    BigInt(data.incomeTotal) === 0n &&
    BigInt(data.expenseTotal) === 0n;

  return (
    <div className="space-y-4">
      <PeriodSelector period={period} today={today} weekStart={weekStart} />

      <div
        role="radiogroup"
        aria-label="Income or expense"
        className="bg-surface-muted rounded-control grid grid-cols-2 gap-1 p-1"
      >
        {(["expense", "income"] as const).map((value) => {
          const active = kind === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => chooseKind(value)}
              className={cn(
                " h-11 rounded-lg text-sm font-semibold transition-colors  ",
                "text-text-secondary",
                active && value === "expense" && "bg-tint-rose text-expense",
                active && value === "income" && "bg-tint-mint text-income",
                active && "shadow-sm",
              )}
            >
              {value === "expense" ? "Expense" : "Income"}
            </button>
          );
        })}
      </div>

      {nothing ? (
        <EmptyState
          art="analysis"
          icon={ChartPie}
          title="Nothing in this period"
          description="The charts fill in from the same rows Records lists, so they need a record or two first."
          action={<AddRecordButton />}
        />
      ) : (
        <>
          {/*
            A bento grid: two columns on a phone, six from `lg`.

            Six because the one card worth more room is the donut — it is
            the answer to "where did it go", and at a third of the width its
            labels collide. The four stat tiles sit two-by-two beside it,
            and the two time charts take half the width each: they are read
            left to right, so they want length more than height.

            On a phone it is a stack, in the order the questions come: the
            sentence, then how much a day, then where, then when.
          */}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 grid grid-cols-2 gap-3 lg:grid-cols-6">
              {insight ? (
                <p className="bento col-span-2 px-4 py-3 text-sm font-semibold lg:col-span-6">
                  {insight}
                </p>
              ) : null}

              {data.categories.length > 0 ? (
                <CategoryDonut
                  slices={data.categories}
                  total={data.total}
                  kind={kind}
                  recordsHref={recordsHref}
                  className="col-span-2 lg:col-span-4 lg:row-span-2"
                />
              ) : null}

              <SummaryCards data={data} kind={kind} />

              <PeriodBars
                period={period}
                series={data.series}
                bucket={data.bucket}
                incomeTotal={data.incomeTotal}
                expenseTotal={data.expenseTotal}
                className="col-span-2 lg:col-span-3"
              />

              <BalanceLine
                points={data.balances}
                bucket={data.bucket}
                accounts={accounts}
                accountId={accountId}
                className="col-span-2 lg:col-span-3"
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
