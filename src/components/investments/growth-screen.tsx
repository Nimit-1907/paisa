"use client";

import * as React from "react";

import Link from "next/link";

import { PauseCircle, TrendingUp } from "lucide-react";

import { NewInvestmentButton } from "@/components/investments/new-investment-button";
import { useFormatMoney } from "@/components/profile-provider";
import { Amount } from "@/components/shared/amount";
import { EmptyState } from "@/components/shared/empty-state";
import { HeroStat } from "@/components/shared/hero-stat";
import { SectionHeader } from "@/components/shared/section-header";
import { SegmentedControl } from "@/components/shared/segmented-control";
import { Card, ListCard } from "@/components/shared/surface";
import { Tile, tintBackground } from "@/components/shared/tile";
import {
  CADENCE_LABELS,
  type Horizon,
  HORIZONS,
  type Investment,
  type InvestmentGoal,
  KIND_META,
  projectContributions,
} from "@/lib/investments";
import { cn } from "@/lib/utils";
import { dateFormat } from "@/lib/date-format";

/**
 * Years from now, in money put in.
 *
 * Only what the running SIPs, RDs and other schedules will add on their own
 * dates, on top of what is in today. No return is assumed and no payout is
 * predicted, and the screen says so, because a figure that looks like a
 * forecast will be read as one.
 */
export function GrowthScreen({
  investments,
  goals,
  today,
}: {
  investments: Investment[];
  goals: InvestmentGoal[];
  today: string;
}) {
  const formatMoney = useFormatMoney();
  const [years, setYears] = React.useState<Horizon>(5);

  const projection = projectContributions(investments, goals, today, years);
  const until = formatMonthYear(projection.until);
  const whole = (value: number) => formatMoney(BigInt(value), { whole: true });

  if (investments.every((i) => i.status !== "open")) {
    return (
      <EmptyState
        icon={TrendingUp}
        title="Nothing to grow yet"
        description="Add a SIP or RD and this shows what you will have put in, 1 to 20 years from now."
        action={<NewInvestmentButton goals={goals} today={today} />}
      />
    );
  }

  return (
    <div className="space-y-6">
      <SegmentedControl
        label="How far ahead"
        value={String(years) as `${Horizon}`}
        onChange={(next) => setYears(Number(next) as Horizon)}
        options={HORIZONS.map((value) => ({
          value: String(value) as `${Horizon}`,
          label: `${value}y`,
        }))}
      />

      <HeroStat
        label={`Put in by ${until}`}
        value={<Amount value={BigInt(projection.total)} whole />}
        helper={
          projection.added > 0
            ? `${whole(projection.added)} more than today's ${whole(projection.now)}`
            : `The same as today: nothing is set to repeat`
        }
      />

      <p className="text-text-secondary px-1 text-xs">
        Counts what you have in today plus every instalment your schedules will
        post by then. No returns are assumed, and payouts are not predicted.
      </p>

      {projection.byGoal.length > 0 ? (
        <section aria-label="By goal" className="space-y-1.5">
          <SectionHeader className="px-1" title="By goal" />
          <ListCard>
            {projection.byGoal.map((row) => {
              const target = row.goal?.targetAmount ?? null;
              return (
                <li key={row.goal?.id ?? "none"}>
                  <Link
                    href={`/investments/goals/${row.goal?.id ?? "none"}`}
                    className="hoverable:bg-surface-muted flex min-h-16 items-center gap-3 px-3 py-2"
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        "border-ink size-3 shrink-0 rounded-[4px] border",
                        tintBackground(row.goal?.tint ?? "neutral"),
                      )}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">
                        {row.goal?.name ?? "No goal"}
                      </span>
                      <span className="text-text-secondary block truncate text-xs">
                        {[
                          row.added > 0
                            ? `+${whole(row.added)} from today`
                            : "No instalments",
                          target
                            ? row.total >= target
                              ? "target reached"
                              : `${Math.round((row.total / target) * 100)}% of target`
                            : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm font-semibold">
                      <Amount value={BigInt(row.total)} whole />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ListCard>
        </section>
      ) : null}

      <section aria-label="What keeps adding" className="space-y-1.5">
        <SectionHeader
          className="px-1"
          title="What keeps adding"
          description={`Instalments from now to ${until}`}
        />
        {projection.contributors.length === 0 ? (
          <Card className="space-y-3 p-4 text-center">
            <p className="text-text-secondary text-sm">
              Nothing repeats, so nothing will be added on its own. A SIP or RD
              will show here.
            </p>
            <div className="flex justify-center">
              <NewInvestmentButton goals={goals} today={today} />
            </div>
          </Card>
        ) : (
          <ListCard>
            {projection.contributors.map((contributor) => {
              const { investment } = contributor;
              const meta = KIND_META[investment.kind];
              const schedule = investment.schedule;
              return (
                <li key={investment.id}>
                  <Link
                    href={`/investments/${investment.id}`}
                    className="hoverable:bg-surface-muted flex min-h-16 items-center gap-3 px-3 py-2"
                  >
                    <Tile tint={meta.tint} icon={meta.icon} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">
                        {investment.name}
                      </span>
                      <span className="text-text-secondary block truncate text-xs">
                        {schedule ? `${whole(schedule.amount)} × ` : ""}
                        {contributor.count}
                        {contributor.endsOn
                          ? `, ends ${formatMonthYear(contributor.endsOn)}`
                          : ""}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm font-semibold">
                      +<Amount value={BigInt(contributor.added)} whole />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ListCard>
        )}
      </section>

      {projection.paused.length > 0 ? (
        <section aria-label="Paused" className="space-y-1.5">
          <SectionHeader
            className="px-1"
            title="Paused"
            description="Not counted until you resume them"
          />
          <ListCard>
            {projection.paused.map((investment) => (
              <li key={investment.id}>
                <Link
                  href={`/investments/${investment.id}`}
                  className="hoverable:bg-surface-muted flex min-h-14 items-center gap-3 px-3 py-2"
                >
                  <PauseCircle
                    className="text-text-secondary size-5 shrink-0"
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                    {investment.name}
                  </span>
                  {investment.schedule ? (
                    <span className="text-text-secondary shrink-0 text-xs">
                      {whole(investment.schedule.amount)}{" "}
                      {CADENCE_LABELS[
                        investment.schedule.cadence
                      ].toLowerCase()}
                    </span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ListCard>
        </section>
      ) : null}
    </div>
  );
}

function formatMonthYear(day: string): string {
  return dateFormat({
    timeZone: "UTC",
    month: "short",
    year: "numeric",
  }).format(new Date(`${day}T00:00:00Z`));
}
