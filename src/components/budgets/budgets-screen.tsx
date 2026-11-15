"use client";

import * as React from "react";

import { Check, Plus, Target } from "lucide-react";

import {
  type BudgetCategoryOption,
  type BudgetDraft,
  BudgetSheet,
} from "@/components/budgets/budget-sheet";
import { Pill } from "@/components/shared/pill";
import { ProgressBar } from "@/components/shared/progress-bar";
import { ListCard } from "@/components/shared/surface";
import { Amount } from "@/components/shared/amount";
import { EmptyState } from "@/components/shared/empty-state";
import { HeroStat } from "@/components/shared/hero-stat";
import { SectionHeader } from "@/components/shared/section-header";

import { Button } from "@/components/ui/button";
import type { BudgetHint, BudgetMonth } from "@/lib/queries/budgets";
import { budgetPercent, budgetTone } from "@/lib/schemas/budgets";
import { cn } from "@/lib/utils";
import { Tile } from "@/components/shared/tile";

/**
 * The Budgets tab.
 *
 * One month at a time, the same month the rest of the app is showing. Spent
 * comes from `month_summary`, so the numbers here are the numbers Records and
 * Analysis show — a budget screen that disagrees with the record list is
 * worse than no budget screen.
 */
export function BudgetsScreen({
  month,
  monthLabel,
  data,
  categories,
  hints,
  isPastMonth,
}: {
  /** `yyyy-mm`. */
  month: string;
  monthLabel: string;
  data: BudgetMonth;
  categories: BudgetCategoryOption[];
  /** What each category has cost, for the suggestions in the sheet. */
  hints: BudgetHint[];
  /** True only for a month that has ended, which is when it can be judged. */
  isPastMonth: boolean;
}) {

  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<BudgetDraft | null>(null);

  /*
   * How the month finished, said once and quietly.
   *
   * Only for a month that has ended: while one is running "under budget" is
   * a guess, and in a month that has not started it is meaningless. No
   * celebration, no colour beyond the one the amounts already use — the
   * reward for keeping to a budget is the number, not applause.
   */
  const kept = data.lines.filter(
    (line) => BigInt(line.spent) <= BigInt(line.budget),
  ).length;

  const totalBudget = BigInt(data.totalBudget);
  const totalSpent = BigInt(data.totalSpent);
  const remaining = totalBudget - totalSpent;
  const tone = budgetTone(totalSpent, totalBudget);
  const percent = budgetPercent(totalSpent, totalBudget);

  function openFor(categoryId: string, amount = "") {
    setDraft({ categoryId, amount });
    setSheetOpen(true);
  }

  function openNew() {
    setDraft(null);
    setSheetOpen(true);
  }

  const sheet = (
    <BudgetSheet
      open={sheetOpen}
      onOpenChange={setSheetOpen}
      month={month}
      monthLabel={monthLabel}
      categories={categories}
      draft={draft}
      hints={hints}
    />
  );

  if (data.lines.length === 0) {
    return (
      <div className="space-y-4">
        <EmptyState
          icon={Target}
          title="No budgets this month"
          description="Set a monthly limit per category and watch what is left, day by day."
          action={
            <Button size="touch" onClick={openNew}>
              <Plus className="size-4" aria-hidden="true" />
              Set a budget
            </Button>
          }
        />

        {sheet}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/*
        The sentence someone opens this screen for is "how much a day have I
        got left", so it is the caption directly under the figure rather than
        the tail of a muted line. The ring keeps its job — the shape of the
        month at a glance — as the hero's aside, at a weight that does not
        argue with the number beside it.
      */}
      {/*
        One figure, one bar, one line. The hero used to carry a per-day
        sentence in small paise, a second "of budgeted" line and two
        buttons; the screen read as a dashboard. Adding a budget now lives
        on the list it adds to.
      */}
      <HeroStat
        label={remaining >= 0n ? "Left to spend" : "Over budget"}
        value={
          <span className={remaining >= 0n ? "text-text" : "text-expense"}>
            <Amount
              value={remaining < 0n ? -remaining : remaining}
              signDisplay="never"
              whole
            />
          </span>
        }
        trend={
          <Pill tone={tone === "over" ? "expense" : "quiet"}>
            {Math.round(percent)}% used
          </Pill>
        }
      >
        <ProgressBar
          percent={percent}
          label="Share of this month's budgets spent"
          className="mt-3"
        />

        <p className="text-text-secondary mt-2 text-xs">
          <Amount value={totalSpent} signDisplay="never" whole /> of{" "}
          <Amount value={totalBudget} signDisplay="never" whole /> spent
          {data.daysLeft > 0 && remaining > 0n ? (
            <>
              {" · "}
              <Amount
                value={remaining / BigInt(data.daysLeft)}
                signDisplay="never"
                whole
              />{" "}
              a day for {data.daysLeft}{" "}
              {data.daysLeft === 1 ? "day" : "days"}
            </>
          ) : null}
        </p>
      </HeroStat>

      {isPastMonth && kept > 0 ? (
        <p className="text-income flex items-center gap-2 px-1 text-sm font-semibold">
          <Check className="size-4 shrink-0" aria-hidden="true" />
          You stayed under budget in {kept} of {data.lines.length}{" "}
          {data.lines.length === 1 ? "category" : "categories"}.
        </p>
      ) : null}

      <section>
        <SectionHeader
          className="mb-1.5 min-h-11 items-center px-1"
          title="Budgets"
          count={data.lines.length}
          trailing={
            <Button
              variant="ghost"
              size="touch"
              className="px-3"
              onClick={openNew}
            >
              <Plus className="size-4" aria-hidden="true" />
              Add
            </Button>
          }
        />

        <ListCard>
          {data.lines.map((line) => (
            <li key={line.categoryId}>
              <BudgetRow
                line={line}
                onOpen={() => openFor(line.categoryId, line.budget)}
              />
            </li>
          ))}
        </ListCard>
      </section>

      {sheet}
    </div>
  );
}

function BudgetRow({
  line,
  onOpen,
}: {
  line: BudgetMonth["lines"][number];
  onOpen: () => void;
}) {
  const budget = BigInt(line.budget);
  const spent = BigInt(line.spent);
  const tone = budgetTone(spent, budget);
  const over = spent - budget;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="hoverable:bg-surface-muted flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left transition-colors"
    >
      <Tile tint={line.tint} icon={line.icon} size="md" />

      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className="truncate text-sm font-semibold">{line.name}</span>
          <span className="amount shrink-0 text-xs font-semibold tabular-nums">
            <Amount value={spent} signDisplay="never" whole />
            <span className="text-text-secondary font-normal">
              {" of "}
              <Amount value={budget} signDisplay="never" whole />
            </span>
          </span>
        </span>

        <ProgressBar
          percent={budgetPercent(spent, budget)}
          label={`${line.name}: ${Math.round(budgetPercent(spent, budget))}% of the budget spent`}
          className="mt-1.5 h-1.5"
        />

        <span
          className={cn(
            "mt-1 block text-xs",
            tone === "over"
              ? "text-expense font-semibold"
              : "text-text-secondary",
          )}
        >
          {tone === "over" ? (
            <>
              Over by <Amount value={over} signDisplay="never" whole />
            </>
          ) : (
            <>
              <Amount value={budget - spent} signDisplay="never" whole /> left
            </>
          )}
        </span>
      </span>
    </button>
  );
}
