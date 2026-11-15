"use client";

import * as React from "react";

import { useRouter } from "next/navigation";

import { CalendarClock, Check, CopyPlus, Plus, Target } from "lucide-react";
import { toast } from "sonner";

import { copyPreviousMonthBudgets } from "@/actions/budgets";
import {
  type BudgetCategoryOption,
  type BudgetDraft,
  BudgetSheet,
} from "@/components/budgets/budget-sheet";
import { BudgetBar, BudgetRing } from "@/components/budgets/budget-ring";
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
  previousLabel,
  data,
  categories,
  hints,
  isPastMonth,
}: {
  /** `yyyy-mm`. */
  month: string;
  monthLabel: string;
  /** The month before this one, short: "Oct". */
  previousLabel: string;
  data: BudgetMonth;
  categories: BudgetCategoryOption[];
  /** What each category has cost, for the suggestions in the sheet. */
  hints: BudgetHint[];
  /** True only for a month that has ended, which is when it can be judged. */
  isPastMonth: boolean;
}) {
  const router = useRouter();

  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<BudgetDraft | null>(null);
  const [copying, setCopying] = React.useState(false);

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

  async function copyPrevious() {
    setCopying(true);

    try {
      const result = await copyPreviousMonthBudgets({ month });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success(
        result.data.copied === 0
          ? "Nothing left to copy"
          : `Copied ${result.data.copied} ${
              result.data.copied === 1 ? "budget" : "budgets"
            }`,
      );
      router.refresh();
    } catch (thrown) {
      console.error("[budgets]", thrown);
      toast.error("Could not copy those. Check your connection.");
    } finally {
      setCopying(false);
    }
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
          art="budgets"
          icon={Target}
          title="No budgets this month"
          description="Set a monthly limit per category and watch what is left, day by day."
          action={
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button size="touch" onClick={openNew}>
                <Plus className="size-4" aria-hidden="true" />
                Set a budget
              </Button>

              {data.previousCount > 0 ? (
                <Button
                  variant="outline"
                  size="touch"
                  disabled={copying}
                  onClick={() => void copyPrevious()}
                >
                  <CopyPlus className="size-4" aria-hidden="true" />
                  Copy {previousLabel}&rsquo;s {data.previousCount}
                </Button>
              ) : null}
            </div>
          }
        />

        {data.unbudgeted.length > 0 ? (
          <Unbudgeted lines={data.unbudgeted} onSet={openFor} />
        ) : null}

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
        helper={
          data.daysLeft > 0 && remaining > 0n ? (
            <span className="text-text font-semibold">
              <Amount
                value={remaining / BigInt(data.daysLeft)}
                signDisplay="never"
              />
              /day for {data.daysLeft}{" "}
              {data.daysLeft === 1 ? "more day" : "more days"}
            </span>
          ) : null
        }
        trend={
          <BudgetRing percent={percent} tone={tone} size={72}>
            <span className="amount text-sm font-semibold tabular-nums">
              {Math.round(percent)}%
            </span>
          </BudgetRing>
        }
      >
        <p className="text-text-secondary mt-1 text-xs">
          <Amount value={totalSpent} signDisplay="never" /> of{" "}
          <Amount value={totalBudget} signDisplay="never" /> budgeted
        </p>

        <div className="mt-4 flex gap-2">
          <Button
            variant="outline"
            size="touch"
            className="flex-1"
            onClick={openNew}
          >
            <Plus className="size-4" aria-hidden="true" />
            Add budget
          </Button>

          {data.previousCount > 0 ? (
            <Button
              variant="outline"
              size="touch"
              className="flex-1"
              disabled={copying}
              onClick={() => void copyPrevious()}
            >
              <CopyPlus className="size-4" aria-hidden="true" />
              Copy {previousLabel}
            </Button>
          ) : null}
        </div>
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
          className="mb-1.5 px-1"
          title={`Budgeted · ${data.lines.length}`}
        />

        <ul className="bg-surface divide-hairline rounded-card divide-y overflow-hidden border">
          {data.lines.map((line) => (
            <li key={line.categoryId}>
              <BudgetRow
                line={line}
                onOpen={() => openFor(line.categoryId, line.budget)}
              />
            </li>
          ))}
        </ul>
      </section>

      {data.unbudgeted.length > 0 ? (
        <Unbudgeted lines={data.unbudgeted} onSet={openFor} />
      ) : null}

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
  const scheduled = BigInt(line.scheduled);
  const tone = budgetTone(spent, budget);
  const over = spent - budget;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="hoverable:bg-surface-muted flex min-h-16 w-full items-center gap-3 px-3 py-2.5 text-left transition-colors   "
    >
      <Tile tint={line.tint} icon={line.icon} size="lg" />

      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className="truncate text-sm font-semibold">{line.name}</span>
          <span className="amount shrink-0 text-xs font-semibold tabular-nums">
            <Amount value={spent} signDisplay="never" />
            <span className="text-text-secondary font-normal">
              {" / "}
              <Amount value={budget} signDisplay="never" />
            </span>
          </span>
        </span>

        <BudgetBar percent={budgetPercent(spent, budget)} tone={tone} />

        <span className="mt-1 flex items-baseline justify-between gap-2">
          {/* What is left is the answer; the scheduled note is the footnote.
              Both were shrinking before, which truncated the number. */}
          <span
            className={cn(
              "shrink-0 text-xs whitespace-nowrap",
              tone === "over" ? "text-expense font-semibold" : "text-text-secondary",
            )}
          >
            {tone === "over"
              ? <>Over by <Amount value={over} signDisplay="never" /></>
              : <><Amount value={budget - spent} signDisplay="never" /> left</>}
          </span>

          {scheduled > 0n ? (
            <span className="text-text-secondary flex min-w-0 items-center gap-1 text-xs">
              <CalendarClock className="size-3 shrink-0" aria-hidden="true" />
              <span className="truncate">
                includes <Amount value={scheduled} signDisplay="never" />{" "}
                scheduled
              </span>
            </span>
          ) : null}
        </span>
      </span>
    </button>
  );
}

/**
 * Expense categories with spending but no limit.
 *
 * This is where a budget usually comes from: someone sees ₹4,200 against Food
 * with nothing holding it, and sets one on the spot.
 */
function Unbudgeted({
  lines,
  onSet,
}: {
  lines: BudgetMonth["unbudgeted"];
  onSet: (categoryId: string) => void;
}) {

  return (
    <section>
      <h2 className="text-text-secondary mb-1.5 px-1 text-xs font-semibold ">
        Not budgeted · {lines.length}
      </h2>

      <ul className="bg-surface divide-hairline divide-y overflow-hidden rounded-card border">
        {lines.map((line) => (
          <li key={line.categoryId} className="flex items-center gap-3 py-2 pl-3">
            <Tile tint={line.tint} icon={line.icon} />

            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">
                {line.name}
              </span>
              <span className="amount text-text-secondary block text-xs">
                <Amount value={BigInt(line.spent)} signDisplay="never" /> spent
              </span>
            </span>

            <Button
              variant="ghost"
              size="touch"
              className="shrink-0 px-3"
              onClick={() => onSet(line.categoryId)}
            >
              Set budget
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
