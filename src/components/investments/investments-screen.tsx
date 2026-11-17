"use client";

import * as React from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  ArrowDownLeft,
  ArrowUpRight,
  Pencil,
  Plus,
  Trash2,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";

import { deleteInvestment } from "@/actions/investments";
import { GoalSheet } from "@/components/investments/goal-sheet";
import { InvestmentSheet } from "@/components/investments/investment-sheet";
import { Amount } from "@/components/shared/amount";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { DateTile } from "@/components/shared/date-tile";
import { EmptyState } from "@/components/shared/empty-state";
import { HeroSplit, HeroStat } from "@/components/shared/hero-stat";
import { ListRow } from "@/components/shared/list-row";
import { Pill } from "@/components/shared/pill";
import { ProgressBar } from "@/components/shared/progress-bar";
import { SectionHeader } from "@/components/shared/section-header";
import { SegmentedControl } from "@/components/shared/segmented-control";
import { ListCard } from "@/components/shared/surface";
import { Tile, tintBackground } from "@/components/shared/tile";
import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { useFormatMoney } from "@/components/profile-provider";
import {
  comingUp,
  describeCadence,
  type GoalTotal,
  goalTotals,
  type Investment,
  type InvestmentGoal,
  KIND_META,
  openTotals,
} from "@/lib/investments";
import { cn } from "@/lib/utils";

/**
 * Investments: what went in, what came out, and what it is for.
 *
 * Net invested leads, because "how much of my money is in there" is the
 * question; Invested and Redeemed sit under it. Then what is due soon, the
 * goals, and the list. Nothing here is valued: no prices, no returns.
 */
export function InvestmentsScreen({
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
  const router = useRouter();
  const formatMoney = useFormatMoney();

  const [goalFilter, setGoalFilter] = React.useState<string | null>(null);
  const [tab, setTab] = React.useState<"open" | "closed">("open");
  const [sheet, setSheet] = React.useState<
    { kind: "new" } | { kind: "edit"; investment: Investment } | null
  >(null);
  const [goalSheet, setGoalSheet] = React.useState<
    { goal: InvestmentGoal | null } | null
  >(null);
  const [deleting, setDeleting] = React.useState<Investment | null>(null);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  const totals = openTotals(investments);
  const upcoming = comingUp(investments, today);
  const byGoal = goalTotals(goals, investments);
  const closedCount = investments.filter((i) => i.status === "closed").length;

  // "none" is the No goal card.
  const visible = investments.filter(
    (investment) =>
      investment.status === tab &&
      (goalFilter === null ||
        (goalFilter === "none"
          ? !investment.goalId
          : investment.goalId === goalFilter)),
  );
  const filterGoal = goals.find((goal) => goal.id === goalFilter) ?? null;

  const sheets = (
    <>
      <InvestmentSheet
        open={sheet !== null}
        onOpenChange={(open) => !open && setSheet(null)}
        investment={sheet?.kind === "edit" ? sheet.investment : null}
        goals={goals}
        today={today}
        defaultGoalId={filterGoal?.id ?? null}
      />
      <GoalSheet
        open={goalSheet !== null}
        onOpenChange={(open) => !open && setGoalSheet(null)}
        goal={goalSheet?.goal ?? null}
        goalCount={goals.length}
      />
    </>
  );

  const newButton = (
    <Button size="touch" onClick={() => setSheet({ kind: "new" })}>
      <Plus className="size-4" aria-hidden="true" />
      New investment
    </Button>
  );

  if (investments.length === 0) {
    return (
      <div className="space-y-6">
        <EmptyState
          icon={TrendingUp}
          title="No investments yet"
          description="Add a SIP, FD, RD, stocks or anything else. Track what goes in and what comes out, by goal. Bank balances are not touched."
          action={newButton}
        />
        {sheets}
      </div>
    );
  }

  async function confirmDelete() {
    const target = deleting;
    if (!target) return;
    setPending(true);
    try {
      const result = await deleteInvestment({ id: target.id });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`${target.name} deleted.`);
      setDeleteOpen(false);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-6">
      <HeroStat
        label="Net invested"
        value={<Amount value={BigInt(totals.net)} whole />}
        helper={`${totals.count} open · ${formatMoney(BigInt(investedThisMonth), { whole: true })} in this month`}
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

      <div className="flex justify-end">{newButton}</div>

      <div className="space-y-6 lg:grid lg:grid-cols-2 lg:items-start lg:gap-6 lg:space-y-0">
        <div className="space-y-6">
          <section aria-label="Coming up" className="space-y-1.5">
            <SectionHeader
              className="px-1"
              title="Coming up"
              description="Instalments and maturities in the next 30 days"
            />
            {upcoming.length === 0 ? (
              <p className="text-text-secondary bg-surface rounded-card border border-dashed px-4 py-6 text-center text-sm">
                Nothing due in the next 30 days.
              </p>
            ) : (
              <ListCard>
                {upcoming.map((item) => (
                  <li
                    key={`${item.investment.id}-${item.kind}`}
                    className="flex min-h-16 items-center gap-3 px-3 py-2"
                  >
                    <DateTile day={item.date} />
                    <Link
                      href={`/investments/${item.investment.id}`}
                      className="min-w-0 flex-1"
                    >
                      <span className="block truncate text-sm font-semibold">
                        {item.investment.name}
                      </span>
                      <span className="text-text-secondary flex items-center gap-1.5 truncate text-xs">
                        {item.kind === "maturity" ? (
                          <>
                            <Pill tone="warning">
                              {item.inDays < 0
                                ? "Matured"
                                : item.inDays === 0
                                  ? "Matures today"
                                  : `Matures in ${item.inDays} ${item.inDays === 1 ? "day" : "days"}`}
                            </Pill>
                            {item.amount !== null ? (
                              <Amount value={BigInt(item.amount)} />
                            ) : null}
                          </>
                        ) : (
                          <>
                            {KIND_META[item.investment.kind].label} instalment ·{" "}
                            {item.amount !== null ? (
                              <Amount value={BigInt(item.amount)} />
                            ) : null}{" "}
                            · posts itself
                          </>
                        )}
                      </span>
                    </Link>
                    {item.kind === "maturity" && item.inDays <= 0 ? (
                      <Button asChild size="touch" variant="outline">
                        <Link href={`/investments/${item.investment.id}?payout=1`}>
                          Payout
                        </Link>
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ListCard>
            )}
          </section>

          <section aria-label="By goal" className="space-y-1.5">
            <SectionHeader
              className="px-1"
              title="By goal"
              trailing={
                <Button
                  variant="ghost"
                  size="touch"
                  onClick={() => setGoalSheet({ goal: null })}
                >
                  <Plus className="size-3.5" aria-hidden="true" />
                  New goal
                </Button>
              }
            />
            {byGoal.length === 0 ? (
              <p className="text-text-secondary bg-surface rounded-card border border-dashed px-4 py-6 text-center text-sm">
                Make a goal, like Retirement or House, to see what each one
                has.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2.5 pr-0.5">
                {byGoal.map((row) => (
                  <GoalCard
                    key={row.goal?.id ?? "none"}
                    row={row}
                    selected={goalFilter === (row.goal?.id ?? "none")}
                    onSelect={() =>
                      setGoalFilter((current) =>
                        current === (row.goal?.id ?? "none")
                          ? null
                          : (row.goal?.id ?? "none"),
                      )
                    }
                    onEdit={
                      row.goal
                        ? () => setGoalSheet({ goal: row.goal })
                        : undefined
                    }
                  />
                ))}
              </div>
            )}
          </section>
        </div>

        <section aria-label="Investments" className="space-y-2">
          <SectionHeader
            className="px-1"
            title={
              goalFilter === null
                ? "All investments"
                : (filterGoal?.name ?? "No goal")
            }
            trailing={
              goalFilter !== null ? (
                <span className="flex items-center gap-1">
                  {filterGoal ? (
                    <Button
                      variant="ghost"
                      size="touch"
                      onClick={() => setGoalSheet({ goal: filterGoal })}
                    >
                      <Pencil className="size-3.5" aria-hidden="true" />
                      Edit goal
                    </Button>
                  ) : null}
                  <Button
                    variant="ghost"
                    size="touch"
                    onClick={() => setGoalFilter(null)}
                  >
                    Show all
                  </Button>
                </span>
              ) : null
            }
          />

          {closedCount > 0 ? (
            <SegmentedControl
              label="Open or closed"
              value={tab}
              onChange={setTab}
              options={[
                { value: "open", label: "Open" },
                { value: "closed", label: `Closed ${closedCount}` },
              ]}
            />
          ) : null}

          {visible.length === 0 ? (
            <p className="text-text-secondary bg-surface rounded-card border border-dashed px-4 py-6 text-center text-sm">
              {tab === "open"
                ? "No open investments here yet."
                : "Nothing closed here."}
            </p>
          ) : (
            <ListCard>
              {visible.map((investment) => (
                <li key={investment.id}>
                  <InvestmentRow
                    investment={investment}
                    onEdit={() => setSheet({ kind: "edit", investment })}
                    onDelete={() => {
                      setDeleting(investment);
                      setDeleteOpen(true);
                    }}
                  />
                </li>
              ))}
            </ListCard>
          )}
        </section>
      </div>

      {sheets}

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete ${deleting?.name ?? "this investment"}?`}
        description={`Its ${deleting?.entryCount ?? 0} ${deleting?.entryCount === 1 ? "entry goes" : "entries go"} with it. To keep the history, close it instead.`}
        pending={pending}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}

function InvestmentRow({
  investment,
  onEdit,
  onDelete,
}: {
  investment: Investment;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const meta = KIND_META[investment.kind];
  const schedule = investment.schedule;

  const detail = schedule
    ? `${describeCadence(schedule.cadence, schedule.startDate, schedule.anchorDay)}${schedule.paused ? " · paused" : ""}`
    : investment.maturityDate
      ? `Matures ${formatShortDay(investment.maturityDate)}`
      : meta.long;

  return (
    <ListRow
      href={`/investments/${investment.id}`}
      leading={<Tile tint={meta.tint} icon={meta.icon} />}
      title={investment.name}
      subtitle={
        <span className="truncate">
          {schedule || investment.maturityDate ? `${meta.label} · ` : ""}
          {detail}
          {investment.platform ? ` · ${investment.platform}` : ""}
        </span>
      }
      trailing={<Amount value={BigInt(investment.net)} />}
      trailingMeta={
        investment.redeemed > 0 ? (
          <>
            out <Amount value={BigInt(investment.redeemed)} compact />
          </>
        ) : (
          `${investment.entryCount} ${investment.entryCount === 1 ? "entry" : "entries"}`
        )
      }
      swipeRight={{ label: "Edit", icon: Pencil, onAction: onEdit }}
      swipeLeft={{
        label: "Delete",
        icon: Trash2,
        tone: "destructive",
        onAction: onDelete,
      }}
      menu={[
        { label: "Edit", icon: Pencil, onAction: onEdit },
        {
          label: "Delete",
          icon: Trash2,
          tone: "destructive",
          onAction: onDelete,
        },
      ]}
    />
  );
}

function GoalCard({
  row,
  selected,
  onSelect,
  onEdit,
}: {
  row: GoalTotal;
  selected: boolean;
  onSelect: () => void;
  onEdit?: () => void;
}) {
  const formatMoney = useFormatMoney();
  const name = row.goal?.name ?? "No goal";
  const percent = Math.round(row.percent);

  const caption =
    row.basis === "target" && row.goal?.targetAmount
      ? `${percent}% of ${formatMoney(BigInt(row.goal.targetAmount), { whole: true })}`
      : `${percent}% of all · ${row.count} ${row.count === 1 ? "investment" : "investments"}`;

  const card = (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        "bg-surface rounded-card pressable flex w-full flex-col gap-2 p-3 text-left",
        selected ? "accent-sm" : "border",
      )}
    >
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
      <span className="text-lg font-bold">
        <Amount value={BigInt(row.net)} whole />
      </span>
      <ProgressBar
        percent={row.percent}
        label={
          row.basis === "target"
            ? `${name}: ${percent}% of target`
            : `${name}: ${percent}% of everything invested`
        }
      />
      <span className="text-text-secondary truncate text-xs">{caption}</span>
    </button>
  );

  if (!onEdit) return card;

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{card}</ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onSelect={onEdit}>
          <Pencil aria-hidden="true" />
          Edit goal
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

function formatShortDay(day: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${day}T00:00:00Z`));
}
