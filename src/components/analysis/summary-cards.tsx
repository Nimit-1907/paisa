"use client";

import { CalendarDays, Tag, TrendingDown, TrendingUp } from "lucide-react";

import { useFormatMoney } from "@/components/profile-provider";
import { bucketTitle } from "@/lib/period";
import type { AnalysisData } from "@/lib/queries/analysis";
import { cn } from "@/lib/utils";

/**
 * The four numbers worth reading before any chart.
 *
 * Average per day, the busiest bucket, the biggest category, and how the
 * period compares with the one before it.
 */
export function SummaryCards({
  data,
  kind,
}: {
  data: AnalysisData;
  kind: "income" | "expense";
}) {
  const formatMoney = useFormatMoney();

  const total = BigInt(data.total);
  const previous = BigInt(data.previousTotal);
  // Divided by the days that have happened, not the days on the calendar:
  // on the 14th, November's spending is spread over 14 days.
  const over = Math.max(1, data.daysElapsed);
  const perDay = total / BigInt(over);
  const top = data.categories[0] ?? null;

  // Percentage in BigInt, then once to a number for display. A previous
  // period of zero has no percentage — everything is an increase from
  // nothing, and "+∞%" is not a useful thing to print.
  const change =
    previous > 0n ? Number(((total - previous) * 1000n) / previous) / 10 : null;

  // For spending, less is good; for income it is the other way round.
  const goodDirection =
    change === null ? null : kind === "expense" ? change <= 0 : change >= 0;

  return (
    <div className="grid grid-cols-2 gap-2">
      <Card
        icon={CalendarDays}
        label="Average per day"
        value={formatMoney(perDay, { signDisplay: "never" })}
        hint={`over ${over} ${over === 1 ? "day" : "days"}${
          data.daysElapsed < data.days ? " so far" : ""
        }`}
      />

      <Card
        icon={kind === "income" ? TrendingUp : TrendingDown}
        label={data.bucket === "day" ? "Biggest day" : "Biggest month"}
        value={
          data.peak
            ? formatMoney(BigInt(data.peak.amount), { signDisplay: "never" })
            : "—"
        }
        hint={data.peak ? bucketTitle(data.peak.on, data.bucket) : "nothing yet"}
      />

      <Card
        icon={Tag}
        label="Top category"
        value={top ? top.name : "—"}
        hint={
          top
            ? formatMoney(BigInt(top.total), { signDisplay: "never" })
            : "nothing yet"
        }
      />

      <Card
        icon={change !== null && change >= 0 ? TrendingUp : TrendingDown}
        label="vs previous"
        value={
          change === null
            ? "—"
            : `${change > 0 ? "+" : ""}${change.toFixed(1)}%`
        }
        hint={
          previous > 0n
            ? `was ${formatMoney(previous, { signDisplay: "never" })}`
            : "nothing to compare"
        }
        tone={goodDirection === null ? undefined : goodDirection ? "good" : "bad"}
      />
    </div>
  );
}

function Card({
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  label: string;
  value: string;
  hint: string;
  tone?: "good" | "bad";
}) {
  return (
    <div className="bg-card rounded-xl border p-3">
      <p className="text-muted-foreground flex items-center gap-1.5 text-label font-medium">
        <Icon className="size-3.5" aria-hidden={true} />
        <span className="truncate">{label}</span>
      </p>

      <p
        className={cn(
          "amount mt-1 truncate text-base font-semibold",
          tone === "good" && "text-income",
          tone === "bad" && "text-expense",
        )}
      >
        {value}
      </p>

      <p className="text-muted-foreground truncate text-label">{hint}</p>
    </div>
  );
}
