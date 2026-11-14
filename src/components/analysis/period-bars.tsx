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
  ChartTooltip,
  useCompactMoney,
  useTooltipTrigger,
} from "@/components/analysis/chart-shell";
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
 * The x-axis thins its own labels — a 31-day month at 360px has about 11px
 * per bar, which fits "14" and nothing else, so only every few days gets a
 * number and the tooltip carries the rest.
 */
export function PeriodBars({
  period,
  series,
  bucket,
  incomeTotal,
  expenseTotal,
}: {
  period: Period;
  series: SeriesPoint[];
  bucket: "day" | "month";
  incomeTotal: string;
  expenseTotal: string;
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


  return (
    <ChartCard
      title={bucket === "day" ? "Day by day" : "Month by month"}
      subtitle={
        <span className="flex items-center gap-3">
          <Swatch color={CHART_COLORS.income} label="Income" />
          <Swatch color={CHART_COLORS.expense} label="Expense" />
        </span>
      }
    >
      <ResponsiveContainer width="100%" height={200}>
        <BarChart
          data={data}
          margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
          barGap={1}
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
            tick={{ fontSize: 11, fill: CHART_COLORS.axis }}
            height={18}
          />
          <YAxis
            width={56}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: CHART_COLORS.axis }}
            tickFormatter={(value: number) => compact(Math.round(value))}
          />

          <Tooltip
            trigger={trigger}
            cursor={{ fill: "var(--muted)", opacity: 0.5 }}
            wrapperStyle={{ outline: "none", zIndex: 20 }}
            content={({ active, payload }) => {
              const point = payload?.[0]?.payload as
                | (typeof data)[number]
                | undefined;
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
            dataKey="income"
            fill={CHART_COLORS.income}
            radius={[2, 2, 0, 0]}
            isAnimationActive={false}
          />
          <Bar
            dataKey="expense"
            fill={CHART_COLORS.expense}
            radius={[2, 2, 0, 0]}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>

      <p className="text-muted-foreground mt-1 px-1 text-xs">
        <span className="text-income font-medium">
          {compact(incomeTotal)} in
        </span>
        {" · "}
        <span className="text-expense font-medium">
          {compact(expenseTotal)} out
        </span>
      </p>
    </ChartCard>
  );
}

function Swatch({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span
        aria-hidden="true"
        className="size-2 rounded-full"
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
  );
}
