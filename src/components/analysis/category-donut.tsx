"use client";

import * as React from "react";

import Link from "next/link";

import { ChevronRight } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import {
  ChartCard,
  ChartTooltip,
  FALLBACK_SLICE_COLORS,
  useTooltipTrigger,
} from "@/components/analysis/chart-shell";
import { useCurrency, useFormatMoney } from "@/components/profile-provider";
import { DynamicIcon } from "@/components/shared/dynamic-icon";
import { formatCompact } from "@/lib/money";
import type { CategorySlice } from "@/lib/queries/analysis";

/**
 * Where the money went, by category.
 *
 * The donut is the shape of the month and the legend underneath is the
 * detail: at 360px a pie with labels around it is unreadable, and the ring
 * plus a list is both smaller and more precise.
 *
 * Every row is a link into Records filtered to that category over the same
 * dates, because "what is that ₹5,150?" is the next question every time.
 */
export function CategoryDonut({
  slices,
  total,
  kind,
  recordsHref,
}: {
  slices: CategorySlice[];
  /** Minor units as text. */
  total: string;
  kind: "income" | "expense";
  /** Builds the Records link for one category. */
  recordsHref: (categoryId: string) => string;
}) {
  const currency = useCurrency();
  const formatMoney = useFormatMoney();
  const trigger = useTooltipTrigger();

  const totalMinor = BigInt(total);

  const data = React.useMemo(
    () =>
      slices.map((slice, index) => ({
        ...slice,
        value: Number(BigInt(slice.total)),
        fill:
          slice.color ??
          FALLBACK_SLICE_COLORS[index % FALLBACK_SLICE_COLORS.length],
      })),
    [slices],
  );

  const share = (amount: bigint) =>
    totalMinor === 0n
      ? 0
      : Number((amount * 1000n) / totalMinor) / 10;

  return (
    <ChartCard
      title={kind === "income" ? "Income by category" : "Spending by category"}
      subtitle={`${slices.length} ${slices.length === 1 ? "category" : "categories"}`}
    >
      <div className="relative">
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={62}
              outerRadius={92}
              paddingAngle={1}
              strokeWidth={0}
              // No animation on the way in: the ring redraws on every period
              // change, and a half-second spin each time reads as lag.
              isAnimationActive={false}
            >
              {data.map((slice) => (
                <Cell key={slice.categoryId} fill={slice.fill} />
              ))}
            </Pie>

            <Tooltip
              trigger={trigger}
              cursor={false}
              wrapperStyle={{ outline: "none", zIndex: 20 }}
              content={({ active, payload }) => {
                const slice = payload?.[0]?.payload as
                  | (CategorySlice & { fill: string })
                  | undefined;
                if (!active || !slice) return null;

                return (
                  <ChartTooltip
                    title={slice.name}
                    rows={[
                      {
                        label: "Total",
                        value: slice.total,
                        color: slice.fill,
                      },
                    ]}
                    hint={`${share(BigInt(slice.total)).toFixed(1)}% of the period`}
                  />
                );
              }}
            />
          </PieChart>
        </ResponsiveContainer>

        {/* The total sits in the hole rather than in a label, which is the
            only place on a 360px ring with room for it. */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-muted-foreground text-label font-semibold tracking-wide uppercase">
            {kind === "income" ? "Earned" : "Spent"}
          </span>
          <span className="amount max-w-[9rem] truncate text-lg font-semibold tabular-nums">
            {formatCompact(totalMinor, {
              symbol: currency.symbol,
              decimals: currency.decimals,
            })}
          </span>
        </div>
      </div>

      <ul className="divide-border mt-2 divide-y border-t">
        {data.map((slice) => (
          <li key={slice.categoryId}>
            <Link
              href={recordsHref(slice.categoryId)}
              className="hoverable:bg-muted/50 focus-visible:ring-ring flex min-h-11 items-center gap-2.5 px-1 py-2 transition-colors focus-visible:ring-2 focus-visible:-outline-offset-2 focus-visible:outline-none"
            >
              <span
                className="flex size-7 shrink-0 items-center justify-center rounded-full text-white"
                style={{ backgroundColor: slice.fill }}
              >
                <DynamicIcon name={slice.icon} className="size-3.5" />
              </span>

              <span className="min-w-0 flex-1 truncate text-sm">
                {slice.name}
              </span>

              <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                {share(BigInt(slice.total)).toFixed(0)}%
              </span>

              <span className="amount shrink-0 text-sm font-semibold tabular-nums">
                {formatMoney(BigInt(slice.total), { signDisplay: "never" })}
              </span>

              <ChevronRight
                className="text-muted-foreground size-4 shrink-0"
                aria-hidden="true"
              />
            </Link>
          </li>
        ))}
      </ul>
    </ChartCard>
  );
}
