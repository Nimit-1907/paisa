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
import { Amount } from "@/components/shared/amount";
import { EmptyState } from "@/components/shared/empty-state";
import { HeroStat } from "@/components/shared/hero-stat";
import { SegmentedControl } from "@/components/shared/segmented-control";
import { AddRecordButton } from "@/components/records/add-record-button";
import { describeInsight } from "@/lib/insight";
import { type Period, periodLabel } from "@/lib/period";
import type { AnalysisData } from "@/lib/queries/analysis";

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

      {/* The shared control, not a tinted one of its own. A segment that
          changes colour with its own value competes with the figures it is
          filtering, which are the things the colour is actually about. */}
      <SegmentedControl
        className="max-w-md"
        label="Income or expense"
        value={kind}
        onChange={chooseKind}
        options={[
          { value: "expense", label: "Expense" },
          { value: "income", label: "Income" },
        ]}
      />

      {nothing ? (
        <EmptyState
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
              {/*
                The one bold card on the screen, and the only figure on it
                that is the period's own total.

                Phase 13 printed the sentence in a flat strip and left the
                total to be read off the middle of the donut, which is the
                one place on the screen already carrying a shape. The
                sentence is the headline; the number it is about belongs
                above it, not inside a ring.
              */}
              <HeroStat
                className="col-span-2 lg:col-span-6"
                label={kind === "income" ? "Earned" : "Spent"}
                value={
                  <span
                    className={kind === "income" ? "text-income" : undefined}
                  >
                    <Amount
                      value={BigInt(data.total)}
                      signDisplay="never"
                      whole
                    />
                  </span>
                }
                helper={insight ?? periodLabel(period)}
              />

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
