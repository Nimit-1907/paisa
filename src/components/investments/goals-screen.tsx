"use client";

import * as React from "react";

import Link from "next/link";

import { Plus, Target } from "lucide-react";

import { GoalSheet } from "@/components/investments/goal-sheet";
import { useFormatMoney } from "@/components/profile-provider";
import { Amount } from "@/components/shared/amount";
import { EmptyState } from "@/components/shared/empty-state";
import { ProgressBar } from "@/components/shared/progress-bar";
import { tintBackground } from "@/components/shared/tile";
import { Button } from "@/components/ui/button";
import {
  type GoalTotal,
  goalTotals,
  type Investment,
  type InvestmentGoal,
} from "@/lib/investments";
import { cn } from "@/lib/utils";

/**
 * What the money is for. One card per goal, each opening the goal's own
 * page; the progress bar is towards the target when there is one, or the
 * goal's share of everything when there is not.
 */
export function GoalsScreen({
  investments,
  goals,
}: {
  investments: Investment[];
  goals: InvestmentGoal[];
}) {
  const [creating, setCreating] = React.useState(false);
  const rows = goalTotals(goals, investments);

  const newGoal = (
    <Button size="touch" onClick={() => setCreating(true)}>
      <Plus className="size-4" aria-hidden="true" />
      New goal
    </Button>
  );

  const sheet = (
    <GoalSheet
      open={creating}
      onOpenChange={setCreating}
      goal={null}
      goalCount={goals.length}
    />
  );

  if (goals.length === 0) {
    return (
      <>
        <EmptyState
          icon={Target}
          title="No goals yet"
          description="Retirement, a house, an emergency fund: give your investments a purpose, and set a target if you have one."
          action={newGoal}
        />
        {sheet}
      </>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">{newGoal}</div>

      <ul className="grid grid-cols-1 gap-2.5 pr-1 sm:grid-cols-2">
        {rows.map((row) => (
          <li key={row.goal?.id ?? "none"}>
            <GoalCard row={row} />
          </li>
        ))}
      </ul>

      {sheet}
    </div>
  );
}

function GoalCard({ row }: { row: GoalTotal }) {
  const formatMoney = useFormatMoney();
  // Investments with no goal are a bucket, not a goal: named as one and
  // drawn with a dashed edge, so the card does not read as a goal you set.
  const name = row.goal?.name ?? "Not in a goal";
  const unassigned = row.goal === null;
  const percent = Math.round(row.percent);
  const target = row.goal?.targetAmount ?? null;

  return (
    <Link
      href={`/investments/goals/${row.goal?.id ?? "none"}`}
      className={cn(
        "bg-surface rounded-card pressable hoverable:bg-surface-muted flex flex-col gap-2.5 border p-4",
        unassigned && "border-dashed",
      )}
    >
      <span className="flex min-w-0 items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2">
          <span
            aria-hidden="true"
            className={cn(
              "border-ink size-3 shrink-0 rounded-[4px] border",
              tintBackground(row.goal?.tint ?? "neutral"),
            )}
          />
          <span className="truncate text-sm font-semibold">{name}</span>
        </span>
        <span className="text-text-secondary shrink-0 text-xs">
          {row.count} {row.count === 1 ? "investment" : "investments"}
        </span>
      </span>

      <span className="text-xl font-bold">
        <Amount value={BigInt(row.net)} whole />
      </span>

      {/* A bar only against a target. A share of everything invested
          drawn the same way read as progress towards something. */}
      {row.basis === "target" && target ? (
        <>
          <ProgressBar
            percent={row.percent}
            label={`${name}: ${percent}% of target`}
          />
          <span className="text-text-secondary text-xs">
            {percent >= 100
              ? `Target of ${formatMoney(BigInt(target), { whole: true })} reached`
              : `${percent}% of ${formatMoney(BigInt(target), { whole: true })}, ${formatMoney(BigInt(Math.max(0, target - row.net)), { whole: true })} to go`}
          </span>
        </>
      ) : (
        <span className="text-text-secondary text-xs">
          {unassigned ? "" : "No target · "}
          {percent}% of everything invested
        </span>
      )}
    </Link>
  );
}
