"use client";

import * as React from "react";

import Link from "next/link";

import { ChevronRight } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import {
  CHART_COLORS,
  ChartCard,
  ChartTooltip,
  useTooltipTrigger,
} from "@/components/analysis/chart-shell";
import { useCurrency } from "@/components/profile-provider";
import { formatCompact } from "@/lib/money";
import type { CategorySlice } from "@/lib/queries/analysis";
import { Amount } from "@/components/shared/amount";
import { Tile } from "@/components/shared/tile";
import { TINT_CYCLE, tintVar } from "@/lib/tokens";

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
  className,
}: {
  slices: CategorySlice[];
  /** Minor units as text. */
  total: string;
  kind: "income" | "expense";
  /** Builds the Records link for one category. */
  recordsHref: (categoryId: string) => string;
  /** Where the bento grid puts this card. */
  className?: string;
}) {
  const currency = useCurrency();
  const trigger = useTooltipTrigger();

  const totalMinor = BigInt(total);

  const data = React.useMemo(
    () =>
      slices.map((slice, index) => ({
        ...slice,
        value: Number(BigInt(slice.total)),
        // The category's own tint, or one of the seven in turn for a
        // category that somehow has none.
        fill: slice.tint
          ? tintVar(slice.tint)
          : TINT_CYCLE[index % TINT_CYCLE.length]!,
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
      className={className}
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
              paddingAngle={2}
              // An ink edge on every slice, which the brief does not ask for
              // and the ring needs. The eight tints are pale by design,
              // measured, rose on surface is 1.1:1, so eight of them
              // adjoining on a white card is a smudge with a hole in it.
              // The outline is what the rest of this language uses to make
              // a pale fill a shape, and it is 3:1 against both surfaces.
              stroke={CHART_COLORS.ink}
              strokeWidth={1}
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
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-0.5">
          <span className="text-text-secondary text-xs">
            {kind === "income" ? "Earned" : "Spent"}
          </span>
          <span className="font-display max-w-[9rem] truncate text-xl tracking-[-0.02em] tabular-nums">
            {formatCompact(totalMinor, {
              symbol: currency.symbol,
              decimals: currency.decimals,
            })}
          </span>
        </div>
      </div>

      <ul className="divide-hairline mt-2 divide-y border-t">
        {data.map((slice) => (
          <li key={slice.categoryId}>
            <Link
              href={recordsHref(slice.categoryId)}
              className="hoverable:bg-surface-muted flex min-h-11 items-center gap-2.5 px-1 py-2 transition-colors   "
            >
              <Tile size="sm" tint={slice.tint} icon={slice.icon} />

              <span className="min-w-0 flex-1 truncate text-sm">
                {slice.name}
              </span>

              <span className="text-text-secondary shrink-0 text-xs tabular-nums">
                {share(BigInt(slice.total)).toFixed(0)}%
              </span>

              <span className="shrink-0 text-sm font-semibold">
                <Amount value={BigInt(slice.total)} signDisplay="never" />
              </span>

              <ChevronRight
                className="text-text-secondary size-4 shrink-0"
                aria-hidden="true"
              />
            </Link>
          </li>
        ))}
      </ul>
    </ChartCard>
  );
}
