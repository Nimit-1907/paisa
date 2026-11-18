"use client";

import * as React from "react";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  axisInterval,
  CHART_COLORS,
  ChartCard,
  ChartTable,
  ChartTooltip,
  useCompactMoney,
  useTooltipTrigger,
} from "@/components/analysis/chart-shell";
import { ordinaryPeak } from "@/components/records/month-star";
import { Deferred } from "@/components/shared/deferred";
import {
  bucketIsPartial,
  bucketLabel,
  bucketTitle,
  type Period,
} from "@/lib/period";
import type { SeriesPoint } from "@/lib/queries/analysis";

/**
 * Income against expense, day by day or month by month.
 *
 * Two bars side by side rather than stacked: the question this chart answers
 * is "did I earn more than I spent", and a stack makes that a subtraction the
 * reader has to do themselves.
 *
 * The x-axis thins its own labels, a 31-day month at 360px has about 11px
 * per bar, which fits "14" and nothing else, so only every few days gets a
 * number and the tooltip carries the rest.
 */
export function PeriodBars({
  period,
  series,
  bucket,
  incomeTotal,
  expenseTotal,
  kind,
  className,
}: {
  /**
   * Which side the bars draw, following the screen's Expense/Income switch.
   * Both on one axis let a single salary day flatten a month of spending
   * to a row of dots. The totals line and the table still give both.
   */
  kind: "expense" | "income";
  period: Period;
  series: SeriesPoint[];
  bucket: "day" | "month";
  incomeTotal: string;
  expenseTotal: string;
  /** Where the bento grid puts this card. */
  className?: string;
}) {
  const compact = useCompactMoney();
  const trigger = useTooltipTrigger();

  const data = React.useMemo(
    () =>
      series.map((point) => ({
        on: point.on,
        label: bucketLabel(point.on, bucket),
        partial: bucketIsPartial(period, point.on, bucket),
        // Recharts measures in numbers; the exact minor units travel
        // alongside for the tooltip to format.
        income: Number(BigInt(point.income)),
        expense: Number(BigInt(point.expense)),
        incomeMinor: point.income,
        expenseMinor: point.expense,
      })),
    [series, bucket, period],
  );

  /*
   * One rent day five times the rest drew the month as a row of stubs.
   * Scaled to the busiest ordinary day instead, the way the Records card is,
   * and the outlier runs off the top with a line under the chart naming it.
   * Only when there is an outlier worth the trade: otherwise the plain
   * maximum is the honest scale.
   */
  const scale = React.useMemo(() => {
    const values = data.map((point) => point[kind]);
    const max = Math.max(0, ...values);
    const ordinary = ordinaryPeak(values);
    if (max <= ordinary * 2.5) return null;

    const tallest = data.find((point) => point[kind] === max) ?? null;
    return { top: Math.ceil(ordinary * 1.4), tallest };
  }, [data, kind]);

  return (
    <ChartCard
      title={bucket === "day" ? "Day by day" : "Month by month"}
      className={className}
      subtitle={
        <span className="flex items-center gap-3">
          {kind === "income" ? (
            <Swatch color={CHART_COLORS.income} label="Income" />
          ) : (
            <Swatch color={CHART_COLORS.expense} label="Expense" />
          )}
        </span>
      }
    >
      {/* The table below carries these numbers; recharts' own SVG would
          read out as a list of paths. */}
      <div aria-hidden="true">
        <Deferred placeholderClassName="h-[200px]">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart
              data={data}
              margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
              barGap={1}
              // Recharts makes its surface focusable. Hidden from a screen
              // reader and still in the tab order is the worst of both, and the
              // table below is the accessible version of this.
              tabIndex={-1}
            >
              <CartesianGrid
                vertical={false}
                stroke={CHART_COLORS.grid}
                strokeDasharray="3 3"
              />
              <XAxis
                dataKey="label"
                interval={axisInterval(data.length)}
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 12, fill: CHART_COLORS.axis }}
                height={18}
              />
              <YAxis
                width={56}
                domain={scale ? [0, scale.top] : undefined}
                allowDataOverflow={scale !== null}
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 12, fill: CHART_COLORS.axis }}
                tickFormatter={(value: number) => compact(Math.round(value))}
              />

              <Tooltip
                trigger={trigger}
                cursor={{ fill: CHART_COLORS.muted, opacity: 0.4 }}
                wrapperStyle={{ outline: "none", zIndex: 20 }}
                content={({ active, payload }) => {
                  const point = payload?.[0]?.payload as
                    (typeof data)[number] | undefined;
                  if (!active || !point) return null;

                  return (
                    <ChartTooltip
                      title={`${bucketTitle(point.on, bucket)}${
                        point.partial ? " (part)" : ""
                      }`}
                      rows={[
                        {
                          label: "Income",
                          value: point.incomeMinor,
                          color: CHART_COLORS.income,
                        },
                        {
                          label: "Expense",
                          value: point.expenseMinor,
                          color: CHART_COLORS.expense,
                        },
                      ]}
                    />
                  );
                }}
              />

              <Bar
                dataKey={kind}
                fill={
                  kind === "income" ? CHART_COLORS.income : CHART_COLORS.expense
                }
                radius={[3, 3, 0, 0]}
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
        </Deferred>
      </div>

      {scale?.tallest ? (
        <p className="text-text-secondary mt-1 px-1 text-xs">
          {bucketTitle(scale.tallest.on, bucket)} runs off the top:{" "}
          <span className="text-text font-semibold">
            {compact(
              kind === "income"
                ? scale.tallest.incomeMinor
                : scale.tallest.expenseMinor,
            )}
          </span>
        </p>
      ) : null}

      <p className="text-text-secondary mt-1 px-1 text-xs">
        <span className="text-income font-semibold">
          {compact(incomeTotal)} in
        </span>
        {" · "}
        <span className="text-expense font-semibold">
          {compact(expenseTotal)} out
        </span>
      </p>

      <ChartTable
        caption={
          bucket === "day"
            ? "Income and expense for each day of the period"
            : "Income and expense for each month of the period"
        }
        columns={[bucket === "day" ? "Day" : "Month", "In", "Out"]}
        rows={data.map((point) => ({
          label: point.label,
          values: [point.incomeMinor, point.expenseMinor],
        }))}
      />
    </ChartCard>
  );
}

/** A 8px square, not a dot: the rest of this app identifies with squares. */
function Swatch({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        aria-hidden="true"
        className="size-2 rounded-[2px]"
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
  );
}
