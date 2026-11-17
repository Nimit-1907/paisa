"use client";

import Link from "next/link";

import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronRight,
  Layers,
  Target,
  TrendingUp,
} from "lucide-react";

import { ComingUpList } from "@/components/investments/coming-up";
import { NewInvestmentButton } from "@/components/investments/new-investment-button";
import { useFormatMoney } from "@/components/profile-provider";
import { Amount } from "@/components/shared/amount";
import { EmptyState } from "@/components/shared/empty-state";
import { HeroSplit, HeroStat } from "@/components/shared/hero-stat";
import { SectionHeader } from "@/components/shared/section-header";
import { ListCard } from "@/components/shared/surface";
import {
  comingUp,
  type Investment,
  type InvestmentGoal,
  openTotals,
  projectContributions,
} from "@/lib/investments";

/**
 * The first Investments screen: where the money stands and what happens
 * next. Everything else is a tap away on its own screen, so this one stays
 * short: the total, the next 30 days, and a line into each of the others.
 */
export function OverviewScreen({
  investments,
  goals,
  investedThisMonth,
  today,
}: {
  investments: Investment[];
  goals: InvestmentGoal[];
  investedThisMonth: number;
  today: string;
}) {
  const formatMoney = useFormatMoney();

  if (investments.length === 0) {
    return (
      <EmptyState
        icon={TrendingUp}
        title="No investments yet"
        description="Add a SIP, FD, RD, stocks or anything else. Track what goes in and what comes out, by goal. Bank balances are not touched."
        action={<NewInvestmentButton goals={goals} today={today} />}
      />
    );
  }

  const totals = openTotals(investments);
  const upcoming = comingUp(investments, today);
  const fiveYears = projectContributions(investments, goals, today, 5);
  const closed = investments.length - totals.count;

  const whole = (value: number) => formatMoney(BigInt(value), { whole: true });

  return (
    <div className="space-y-6">
      <HeroStat
        label="Net invested"
        value={<Amount value={BigInt(totals.net)} whole />}
        helper={`${totals.count} open · ${whole(investedThisMonth)} in this month`}
        split={
          <>
            <HeroSplit
              icon={<ArrowDownLeft className="size-3.5" aria-hidden="true" />}
              tint="bg-tint-mint"
              label="Invested"
              value={<Amount value={BigInt(totals.invested)} whole />}
            />
            <HeroSplit
              icon={<ArrowUpRight className="size-3.5" aria-hidden="true" />}
              tint="bg-tint-peach"
              label="Redeemed"
              value={<Amount value={BigInt(totals.redeemed)} whole />}
            />
          </>
        }
      />

      <div className="flex justify-end">
        <NewInvestmentButton goals={goals} today={today} />
      </div>

      <section aria-label="Coming up" className="space-y-1.5">
        <SectionHeader
          className="px-1"
          title="Coming up"
          description="Instalments and maturities in the next 30 days"
        />
        <ComingUpList items={upcoming} />
      </section>

      <section aria-label="More about your investments" className="space-y-1.5">
        <SectionHeader className="px-1" title="Explore" />
        <ListCard>
          <JumpRow
            href="/investments/holdings"
            icon={<Layers className="size-4" aria-hidden="true" />}
            tint="bg-tint-lilac"
            title="Holdings"
            detail={`${totals.count} open${closed > 0 ? `, ${closed} closed` : ""}, by kind`}
          />
          <JumpRow
            href="/investments/goals"
            icon={<Target className="size-4" aria-hidden="true" />}
            tint="bg-tint-peri"
            title="Goals"
            detail={
              goals.length === 0
                ? "Group investments by what they are for"
                : `${goals.length} ${goals.length === 1 ? "goal" : "goals"}`
            }
          />
          <JumpRow
            href="/investments/growth"
            icon={<TrendingUp className="size-4" aria-hidden="true" />}
            tint="bg-tint-mint"
            title="Growth"
            detail={
              fiveYears.added > 0
                ? `${whole(fiveYears.total)} put in by ${yearOf(fiveYears.until)}`
                : "What you will have put in, years from now"
            }
          />
        </ListCard>
      </section>
    </div>
  );
}

function JumpRow({
  href,
  icon,
  tint,
  title,
  detail,
}: {
  href: string;
  icon: React.ReactNode;
  tint: string;
  title: string;
  detail: string;
}) {
  return (
    <li>
      <Link
        href={href}
        className="hoverable:bg-surface-muted flex min-h-16 items-center gap-3 px-3 py-2"
      >
        <span
          aria-hidden="true"
          className={`text-text rounded-control flex size-9 shrink-0 items-center justify-center ${tint}`}
        >
          {icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">{title}</span>
          <span className="text-text-secondary block truncate text-xs">
            {detail}
          </span>
        </span>
        <ChevronRight
          className="text-text-secondary size-4 shrink-0"
          aria-hidden="true"
        />
      </Link>
    </li>
  );
}

function yearOf(day: string): string {
  return day.slice(0, 4);
}
