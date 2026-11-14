"use client";

import * as React from "react";

import { useCurrency } from "@/components/profile-provider";
import { useIsDesktop } from "@/hooks/use-media-query";
import { formatCompact, formatWith } from "@/lib/money";
import { cn } from "@/lib/utils";

/**
 * What every chart on this screen shares.
 *
 * The colours are CSS variables rather than hex strings, so an SVG fill
 * resolves against the element's own computed style and the charts follow
 * light and dark without a theme hook or a re-render.
 */
export const CHART_COLORS = {
  income: "var(--income)",
  expense: "var(--expense)",
  balance: "var(--transfer)",
  grid: "var(--border)",
  axis: "var(--muted-foreground)",
} as const;

/** The palette a donut falls back to when a category has no colour of its own. */
export const FALLBACK_SLICE_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

/**
 * Hover on a pointer, tap on a touchscreen.
 *
 * Recharts' default is hover, which on a phone means the tooltip appears
 * under the thumb that is covering it and then will not go away. Click is the
 * gesture that works on a touchscreen.
 */
export function useTooltipTrigger(): "hover" | "click" {
  return useIsDesktop() ? "hover" : "click";
}

/**
 * How many ticks to skip so the x-axis stays readable.
 *
 * Roughly one label per 48px of a 328px-wide plot: a 31-day month at 360px
 * leaves about 11px per bar, which fits "14" and nothing else.
 */
export function axisInterval(count: number): number {
  return Math.max(0, Math.ceil(count / 7) - 1);
}

/** Abbreviated money for an axis: ₹1.2K, ₹3.4L. */
export function useCompactMoney() {
  const currency = useCurrency();

  return React.useCallback(
    (minor: bigint | number | string) =>
      formatCompact(BigInt(minor), {
        symbol: currency.symbol,
        decimals: currency.decimals,
      }),
    [currency.symbol, currency.decimals],
  );
}

/** A card with a title, the chart, and room for a legend underneath. */
export function ChartCard({
  title,
  subtitle,
  actions,
  children,
  className,
}: {
  title: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("bg-card rounded-2xl border p-3 sm:p-4", className)}>
      <div className="mb-2 flex items-start justify-between gap-2 px-1">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold">{title}</h2>
          {subtitle ? (
            <p className="text-muted-foreground truncate text-xs">{subtitle}</p>
          ) : null}
        </div>
        {actions}
      </div>

      {children}
    </section>
  );
}

export type TooltipRow = {
  label: string;
  /** Minor units as text. */
  value: string;
  color?: string;
};

/**
 * The tooltip body, styled like the rest of the app rather than like recharts.
 *
 * Amounts are shown in full here — this is the one place with room for them,
 * and the abbreviations on the axis are a reading aid, not the answer.
 */
export function ChartTooltip({
  title,
  rows,
  hint,
}: {
  title: string;
  rows: TooltipRow[];
  hint?: string;
}) {
  const currency = useCurrency();

  return (
    <div className="bg-popover text-popover-foreground rounded-xl border px-3 py-2 text-xs shadow-md">
      <p className="font-semibold">{title}</p>

      <ul className="mt-1 space-y-0.5">
        {rows.map((row) => (
          <li key={row.label} className="flex items-center gap-2">
            {row.color ? (
              <span
                aria-hidden="true"
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: row.color }}
              />
            ) : null}
            <span className="text-muted-foreground">{row.label}</span>
            <span className="amount ml-auto font-semibold tabular-nums">
              {formatWith(currency, BigInt(row.value), {
                signDisplay: "never",
              })}
            </span>
          </li>
        ))}
      </ul>

      {hint ? <p className="text-muted-foreground mt-1">{hint}</p> : null}
    </div>
  );
}
