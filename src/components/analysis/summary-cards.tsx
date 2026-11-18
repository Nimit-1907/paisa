"use client";

import { CalendarDays, Tag, TrendingDown, TrendingUp } from "lucide-react";

import { useFormatMoney } from "@/components/profile-provider";
import { Amount } from "@/components/shared/amount";
import { Card as Surface } from "@/components/shared/surface";
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
  // period of zero has no percentage, everything is an increase from
  // nothing, and "+∞%" is not a useful thing to print.
  const change =
    previous > 0n ? Number(((total - previous) * 1000n) / previous) / 10 : null;

  // For spending, less is good; for income it is the other way round.
  const goodDirection =
    change === null ? null : kind === "expense" ? change <= 0 : change >= 0;

  // A fragment, not a grid of its own: these four are cells in the screen's
  // bento, so the page decides where they sit. Nesting a grid here would
  // make them one cell wearing four hats, and they would not line up with
  // the cards beside them.
  return (
    <>
      <Card
        icon={CalendarDays}
        label="Average per day"
        // Whole rupees: an average is an estimate, and ₹2,196.33 claims a
        // precision it does not have beside figures that are all whole.
        value={<Amount value={perDay} signDisplay="never" whole />}
        hint={`over ${over} ${over === 1 ? "day" : "days"}${
          data.daysElapsed < data.days ? " so far" : ""
        }`}
      />

      <Card
        icon={kind === "income" ? TrendingUp : TrendingDown}
        label={data.bucket === "day" ? "Biggest day" : "Biggest month"}
        value={
          data.peak ? (
            <Amount value={BigInt(data.peak.amount)} signDisplay="never" />
          ) : (
            "None"
          )
        }
        hint={
          data.peak ? bucketTitle(data.peak.on, data.bucket) : "nothing yet"
        }
      />

      <Card
        icon={Tag}
        label="Top category"
        value={top ? top.name : "None"}
        hint={
          top
            ? formatMoney(BigInt(top.total), {
                signDisplay: "never",
                paise: "trim",
              })
            : "nothing yet"
        }
      />

      <Card
        icon={change !== null && change >= 0 ? TrendingUp : TrendingDown}
        label={`vs ${data.previousLabel}`}
        value={
          change === null
            ? "None"
            : `${change > 0 ? "+" : ""}${change.toFixed(1)}%`
        }
        hint={
          previous > 0n
            ? `was ${formatMoney(previous, { signDisplay: "never", paise: "trim" })}`
            : "nothing to compare"
        }
        tone={
          goodDirection === null ? undefined : goodDirection ? "good" : "bad"
        }
      />
    </>
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
  value: React.ReactNode;
  hint: string;
  tone?: "good" | "bad";
}) {
  return (
    // A quarter of the strip from `lg`, half a row on a phone. They no
    // longer sit beside the donut, so nothing stretches them.
    <Surface className="flex flex-col p-3 lg:col-span-3">
      <p className="text-text-secondary flex items-center gap-1.5 text-xs">
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

      <p className="text-text-secondary truncate text-xs">{hint}</p>
    </Surface>
  );
}
