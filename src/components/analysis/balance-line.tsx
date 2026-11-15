"use client";

import * as React from "react";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  Area,
  AreaChart,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { bucketLabel, bucketTitle } from "@/lib/period";
import type { BalancePoint } from "@/lib/queries/analysis";
import { cn } from "@/lib/utils";
import { tintVar } from "@/lib/tokens";

export type BalanceAccount = {
  id: string;
  name: string;
  /** Kept while the old column exists; nothing reads it since Phase 14. */
  color: string | null;
  icon: string | null;
  /** One of the eight tint keys — the tile beside the name in the menu. */
  tint: string | null;
};

/**
 * What the balance did over the period.
 *
 * An area rather than a bare line: the shape of "going up" or "going down" is
 * the whole message, and the fill makes it legible at 200px tall on a phone.
 *
 * The y-axis is not forced to zero. A balance that moves between ₹30,000 and
 * ₹34,000 would be a flat line against a zero baseline, which is exactly the
 * information someone opened this chart for.
 */
export function BalanceLine({
  points,
  bucket,
  accounts,
  accountId,
  className,
}: {
  points: BalancePoint[];
  bucket: "day" | "month";
  accounts: BalanceAccount[];
  /** Null means every account counted in the total. */
  accountId: string | null;
  /** Where the bento grid puts this card. */
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const compact = useCompactMoney();
  const trigger = useTooltipTrigger();

  const data = React.useMemo(
    () =>
      points.map((point) => ({
        on: point.on,
        label: bucketLabel(point.on, bucket),
        balance: Number(BigInt(point.balance)),
        balanceMinor: point.balance,
      })),
    [points, bucket],
  );

  const selected = accounts.find((account) => account.id === accountId);

  function choose(id: string | null) {
    const next = new URLSearchParams(params.toString());
    if (id) next.set("a", id);
    else next.delete("a");

    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  const negative = data.some((point) => point.balance < 0);

  return (
    <ChartCard
      title="Balance"
      className={className}
      subtitle={selected ? selected.name : "All accounts in your total"}
      actions={
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="touch" className="min-w-11 shrink-0 px-2.5">
              {selected ? selected.name : "All"}
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem
              className="min-h-11 px-2"
              onSelect={() => choose(null)}
            >
              <span className={cn(!accountId && "font-semibold")}>
                All accounts
              </span>
            </DropdownMenuItem>

            {accounts.map((account) => (
              <DropdownMenuItem
                key={account.id}
                className="min-h-11 gap-2 px-2"
                onSelect={() => choose(account.id)}
              >
                <span
                  aria-hidden="true"
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: tintVar(account.tint) }}
                />
                <span
                  className={cn(
                    "truncate",
                    account.id === accountId && "font-semibold",
                  )}
                >
                  {account.name}
                </span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      }
    >
      {/* The table below carries these numbers; recharts' own SVG would
          read out as a list of paths. */}
      <div aria-hidden="true">
      <ResponsiveContainer width="100%" height={180}>
        <AreaChart
          data={data}
          margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
          // See period-bars: the surface is focusable by default, and this
          // one is hidden in favour of the table underneath it.
          tabIndex={-1}
        >
          <defs>
            <linearGradient id="balance-fill" x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="0%"
                stopColor={CHART_COLORS.ink}
                stopOpacity={0.3}
              />
              <stop
                offset="100%"
                stopColor={CHART_COLORS.ink}
                stopOpacity={0}
              />
            </linearGradient>
          </defs>

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
            // Not forced to zero, and the domain is padded a little so the
            // line never sits on the top or bottom edge of the plot.
            domain={[
              (min: number) => Math.floor(min - Math.abs(min) * 0.05),
              (max: number) => Math.ceil(max + Math.abs(max) * 0.05),
            ]}
            tickFormatter={(value: number) => compact(Math.round(value))}
          />

          <Tooltip
            trigger={trigger}
            cursor={{ stroke: CHART_COLORS.ink, strokeDasharray: "3 3" }}
            wrapperStyle={{ outline: "none", zIndex: 20 }}
            content={({ active, payload }) => {
              const point = payload?.[0]?.payload as
                (typeof data)[number] | undefined;
              if (!active || !point) return null;

              return (
                <ChartTooltip
                  title={bucketTitle(point.on, bucket)}
                  rows={[
                    {
                      label: "Balance",
                      value: point.balanceMinor,
                      color: CHART_COLORS.ink,
                    },
                  ]}
                />
              );
            }}
          />

          <Area
            type="monotone"
            dataKey="balance"
            stroke={CHART_COLORS.ink}
            strokeWidth={2}
            fill="url(#balance-fill)"
            isAnimationActive={false}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </AreaChart>
      </ResponsiveContainer>
      </div>

      {negative ? (
        <p className="text-expense mt-1 px-1 text-xs">
          The balance went below zero during this period.
        </p>
      ) : null}

      <ChartTable
        caption={`Running balance for ${selected ? selected.name : "all accounts"}, ${bucket === "day" ? "day by day" : "month by month"}`}
        columns={[bucket === "day" ? "Day" : "Month", "Balance"]}
        rows={data.map((point) => ({
          label: point.label,
          values: [point.balanceMinor],
        }))}
        signed
      />
    </ChartCard>
  );
}
