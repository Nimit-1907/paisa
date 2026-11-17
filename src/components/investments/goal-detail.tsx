"use client";

import * as React from "react";

import { useRouter } from "next/navigation";

import { Pencil, Target } from "lucide-react";

import { GoalSheet } from "@/components/investments/goal-sheet";
import { InvestmentList } from "@/components/investments/investment-list";
import { NewInvestmentButton } from "@/components/investments/new-investment-button";
import { useFormatMoney } from "@/components/profile-provider";
import { Amount } from "@/components/shared/amount";
import { EmptyState } from "@/components/shared/empty-state";
import { HeroStat } from "@/components/shared/hero-stat";
import { ProgressBar } from "@/components/shared/progress-bar";
import { SectionHeader } from "@/components/shared/section-header";
import { Button } from "@/components/ui/button";
import {
  type Investment,
  type InvestmentGoal,
  projectContributions,
} from "@/lib/investments";

/**
 * One goal: how much is in it, how far it is from its target, what keeps
 * adding to it, and the investments themselves. `goal` null is "No goal".
 */
export function GoalDetail({
  goal,
  investments,
  goals,
  today,
}: {
  goal: InvestmentGoal | null;
  /** Only this goal's investments, open and closed. */
  investments: Investment[];
  goals: InvestmentGoal[];
  today: string;
}) {
  const router = useRouter();
  const formatMoney = useFormatMoney();
  const [editing, setEditing] = React.useState(false);

  const open = investments.filter((i) => i.status === "open");
  const closed = investments.filter((i) => i.status === "closed");
  const net = open.reduce((sum, i) => sum + i.net, 0);
  const target = goal?.targetAmount ?? null;
  const percent = target ? (net / target) * 100 : null;

  const monthly = open.reduce((sum, i) => {
    const s = i.schedule;
    if (!s || s.paused) return sum;
    if (s.cadence === "monthly") return sum + s.amount;
    if (s.cadence === "quarterly") return sum + s.amount / 3;
    return sum + s.amount / 12;
  }, 0);
  const inFiveYears = projectContributions(open, goal ? [goal] : [], today, 5);

  const whole = (value: number) =>
    formatMoney(BigInt(Math.round(value)), { whole: true });

  return (
    <div className="space-y-6">
      <HeroStat
        label={goal ? "In this goal" : "Not in any goal"}
        value={<Amount value={BigInt(net)} whole />}
        helper={
          monthly > 0
            ? `${whole(monthly)} a month going in · ${whole(inFiveYears.total)} put in by ${inFiveYears.until.slice(0, 4)}`
            : `${open.length} open ${open.length === 1 ? "investment" : "investments"}`
        }
      >
        {target && percent !== null ? (
          <div className="mt-3 space-y-1.5">
            <ProgressBar
              percent={percent}
              label={`${Math.round(percent)}% of target`}
            />
            <p className="text-text-secondary text-xs">
              {percent >= 100
                ? `Target of ${whole(target)} reached`
                : `${Math.round(percent)}% of ${whole(target)} · ${whole(target - net)} to go`}
            </p>
          </div>
        ) : null}
      </HeroStat>

      <div className="flex flex-wrap justify-end gap-2">
        {goal ? (
          <Button
            size="touch"
            variant="outline"
            onClick={() => setEditing(true)}
          >
            <Pencil className="size-4" aria-hidden="true" />
            Edit goal
          </Button>
        ) : null}
        <NewInvestmentButton
          goals={goals}
          today={today}
          goalId={goal?.id ?? null}
        />
      </div>

      {investments.length === 0 ? (
        <EmptyState
          icon={Target}
          title="Nothing in this goal yet"
          description="Add an investment here, or move one in with its Edit."
        />
      ) : (
        <>
          <section aria-label="Open" className="space-y-1.5">
            <SectionHeader className="px-1" title="Open" count={open.length} />
            {open.length > 0 ? (
              <InvestmentList investments={open} goals={goals} today={today} />
            ) : (
              <p className="text-text-secondary bg-surface rounded-card border border-dashed px-4 py-6 text-center text-sm">
                Nothing open in this goal.
              </p>
            )}
          </section>

          {closed.length > 0 ? (
            <section aria-label="Closed" className="space-y-1.5">
              <SectionHeader
                className="px-1"
                title="Closed"
                count={closed.length}
              />
              <InvestmentList
                investments={closed}
                goals={goals}
                today={today}
              />
            </section>
          ) : null}
        </>
      )}

      {goal ? (
        <GoalSheet
          open={editing}
          onOpenChange={setEditing}
          goal={goal}
          goalCount={goals.length}
          onDeleted={() => router.push("/investments/goals")}
        />
      ) : null}
    </div>
  );
}
