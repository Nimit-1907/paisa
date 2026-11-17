"use client";

import * as React from "react";

import { useRouter } from "next/navigation";

import {
  ArrowDownLeft,
  ArrowUpRight,
  Archive,
  Pause,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  SkipForward,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import {
  closeInvestment,
  deleteEntry,
  deleteInvestment,
  reopenInvestment,
  setInvestmentPaused,
  skipNextInstallment,
} from "@/actions/investments";
import { EntrySheet } from "@/components/investments/entry-sheet";
import { InvestmentSheet } from "@/components/investments/investment-sheet";
import { PayoutSheet } from "@/components/investments/payout-sheet";
import { Amount } from "@/components/shared/amount";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { formatDay } from "@/components/shared/date-picker";
import { HeroSplit, HeroStat } from "@/components/shared/hero-stat";
import { ListRow } from "@/components/shared/list-row";
import { Pill } from "@/components/shared/pill";
import { SectionHeader } from "@/components/shared/section-header";
import { Card, ListCard } from "@/components/shared/surface";
import { tintBackground } from "@/components/shared/tile";
import { Button } from "@/components/ui/button";
import { useFormatMoney } from "@/components/profile-provider";
import {
  describeCadence,
  type Investment,
  type InvestmentEntry,
  type InvestmentEntryType,
  type InvestmentGoal,
  nextInstallment,
} from "@/lib/investments";
import { dayDifference } from "@/lib/recurrence";
import { cn } from "@/lib/utils";

type EntryAction =
  | { type: "upsert"; entry: InvestmentEntry }
  | { type: "remove"; id: string };

function applyEntry(state: InvestmentEntry[], action: EntryAction) {
  if (action.type === "remove") {
    return state.filter((entry) => entry.id !== action.id);
  }
  const rest = state.filter((entry) => entry.id !== action.entry.id);
  return [action.entry, ...rest].sort(
    (a, b) => b.occurredOn.localeCompare(a.occurredOn),
  );
}

/**
 * One investment: its totals, what it does next, and every entry.
 *
 * The totals are summed from the entries on this page rather than read
 * from the server's summary, so an entry added or removed moves them at
 * once, with the list.
 */
export function InvestmentDetail({
  investment,
  entries,
  goals,
  today,
  openPayout,
}: {
  investment: Investment;
  entries: InvestmentEntry[];
  goals: InvestmentGoal[];
  today: string;
  /** Arrived from the maturity prompt: open the payout straight away. */
  openPayout: boolean;
}) {
  const router = useRouter();
  const formatMoney = useFormatMoney();
  const [, startTransition] = React.useTransition();
  const [items, apply] = React.useOptimistic(entries, applyEntry);

  const [entrySheet, setEntrySheet] = React.useState<{
    entry: InvestmentEntry | null;
    type: InvestmentEntryType;
  } | null>(null);
  const [editOpen, setEditOpen] = React.useState(false);
  const [payoutOpen, setPayoutOpen] = React.useState(openPayout);
  const [confirm, setConfirm] = React.useState<
    "delete" | "close" | { entry: InvestmentEntry } | null
  >(null);
  const [pending, setPending] = React.useState(false);

  const goal = goals.find((g) => g.id === investment.goalId) ?? null;
  const open = investment.status === "open";
  const schedule = investment.schedule;
  const next = nextInstallment(investment, today);

  let invested = 0;
  let redeemed = 0;
  for (const entry of items) {
    if (entry.type === "invest") invested += entry.amount;
    else redeemed += entry.amount;
  }
  const net = invested - redeemed;

  const maturityDays =
    investment.maturityDate !== null
      ? dayDifference(today, investment.maturityDate)
      : null;

  async function run(
    action: () => Promise<{ ok: boolean; error?: string }>,
    success: string,
  ) {
    setPending(true);
    try {
      const result = await action();
      if (!result.ok) {
        toast.error(result.error ?? "That did not work. Try again.");
        return false;
      }
      toast.success(success);
      router.refresh();
      return true;
    } catch (thrown) {
      console.error("[investments]", thrown);
      toast.error("Could not reach Paisa. Check your connection.");
      return false;
    } finally {
      setPending(false);
    }
  }

  function removeEntry(entry: InvestmentEntry) {
    setConfirm(null);
    startTransition(async () => {
      apply({ type: "remove", id: entry.id });
      const result = await deleteEntry({ id: entry.id });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Entry deleted.");
      router.refresh();
    });
  }

  const since = items.length > 0 ? items[items.length - 1]?.occurredOn : null;

  return (
    <div className="space-y-6">
      <HeroStat
        label="Net invested"
        value={<Amount value={BigInt(net)} whole />}
        trend={open ? null : <Pill>Closed</Pill>}
        helper={[
          `${items.length} ${items.length === 1 ? "entry" : "entries"}`,
          open
            ? since
              ? `since ${formatDay(since)}`
              : null
            : investment.closedOn
              ? `closed ${formatDay(investment.closedOn)}`
              : null,
        ]
          .filter(Boolean)
          .join(" · ")}
        split={
          <>
            <HeroSplit
              icon={<ArrowDownLeft className="size-3.5" aria-hidden="true" />}
              tint="bg-tint-mint"
              label="Invested"
              value={<Amount value={BigInt(invested)} />}
            />
            <HeroSplit
              icon={<ArrowUpRight className="size-3.5" aria-hidden="true" />}
              tint="bg-tint-peach"
              label="Redeemed"
              value={<Amount value={BigInt(redeemed)} />}
            />
          </>
        }
      />

      {open ? (
        <div className="grid grid-cols-2 gap-2">
          <Button
            size="touch"
            onClick={() => setEntrySheet({ entry: null, type: "invest" })}
          >
            <Plus className="size-4" aria-hidden="true" />
            Invest
          </Button>
          <Button
            size="touch"
            variant="outline"
            onClick={() => setEntrySheet({ entry: null, type: "redeem" })}
          >
            <ArrowUpRight className="size-4" aria-hidden="true" />
            Redeem
          </Button>
        </div>
      ) : (
        <Button
          size="touch"
          variant="outline"
          className="w-full"
          disabled={pending}
          onClick={() =>
            void run(() => reopenInvestment({ id: investment.id }), "Reopened.")
          }
        >
          <RotateCcw className="size-4" aria-hidden="true" />
          Reopen investment
        </Button>
      )}

      {investment.maturityDate ? (
        <section aria-label="Maturity" className="space-y-1.5">
          <SectionHeader className="px-1" title="Maturity" />
          <Card>
            <dl className="divide-hairline divide-y">
              {investment.interestRate !== null ? (
                <Row label="Rate">{investment.interestRate}% a year</Row>
              ) : null}
              {investment.tenureMonths !== null ? (
                <Row label="Tenure">
                  {investment.tenureMonths}{" "}
                  {investment.tenureMonths === 1 ? "month" : "months"}
                </Row>
              ) : null}
              <Row label="Matures on">
                <span className="flex items-center justify-end gap-1.5">
                  {formatDay(investment.maturityDate)}
                  {open && maturityDays !== null && maturityDays <= 30 ? (
                    <Pill tone="warning">
                      {maturityDays < 0
                        ? "Matured"
                        : maturityDays === 0
                          ? "Today"
                          : `In ${maturityDays} ${maturityDays === 1 ? "day" : "days"}`}
                    </Pill>
                  ) : null}
                </span>
              </Row>
              <Row label="Maturity amount">
                {investment.maturityAmount !== null ? (
                  <Amount value={BigInt(investment.maturityAmount)} />
                ) : (
                  <span className="text-text-secondary">Not entered</span>
                )}
              </Row>
            </dl>
            {open ? (
              <div className="border-t p-3">
                <Button
                  size="touch"
                  variant={maturityDays !== null && maturityDays <= 0 ? "default" : "outline"}
                  className="w-full"
                  onClick={() => setPayoutOpen(true)}
                >
                  Record payout
                </Button>
              </div>
            ) : null}
          </Card>
        </section>
      ) : null}

      {schedule ? (
        <section aria-label="Schedule" className="space-y-1.5">
          <SectionHeader
            className="px-1"
            title="Schedule"
            trailing={schedule.paused ? <Pill>Paused</Pill> : null}
          />
          <Card>
            <dl className="divide-hairline divide-y">
              <Row label="Instalment">
                <Amount value={BigInt(schedule.amount)} />
              </Row>
              <Row label="Repeats">
                {describeCadence(schedule.cadence, schedule.startDate, schedule.anchorDay)}
              </Row>
              <Row label="Next">
                {next
                  ? formatDay(next)
                  : !open
                    ? "Closed"
                    : schedule.paused
                      ? "Paused"
                      : "Finished"}
              </Row>
              <Row label="Ends">
                {schedule.endDate
                  ? `${formatDay(schedule.endDate)}${
                      schedule.installmentsTotal
                        ? `, ${schedule.installmentsTotal} instalments`
                        : ""
                    }`
                  : "Never"}
              </Row>
            </dl>
            {open ? (
              <div className="flex flex-wrap gap-2 border-t p-3">
                <Button
                  size="touch"
                  variant="outline"
                  className="flex-1"
                  disabled={pending}
                  onClick={() =>
                    void run(
                      () =>
                        setInvestmentPaused({
                          id: investment.id,
                          paused: !schedule.paused,
                        }),
                      schedule.paused
                        ? "Resumed. The next instalment posts on its date."
                        : "Paused. Nothing posts until you resume.",
                    )
                  }
                >
                  {schedule.paused ? (
                    <Play className="size-4" aria-hidden="true" />
                  ) : (
                    <Pause className="size-4" aria-hidden="true" />
                  )}
                  {schedule.paused ? "Resume" : "Pause"}
                </Button>
                {next ? (
                  <Button
                    size="touch"
                    variant="outline"
                    className="flex-1"
                    disabled={pending}
                    onClick={() =>
                      void run(
                        () => skipNextInstallment({ id: investment.id }),
                        `Skipped ${formatDay(next)}.`,
                      )
                    }
                  >
                    <SkipForward className="size-4" aria-hidden="true" />
                    Skip {formatDay(next).replace(/ \d{4}$/, "")}
                  </Button>
                ) : null}
              </div>
            ) : null}
          </Card>
        </section>
      ) : null}

      <section aria-label="Details" className="space-y-1.5">
        <SectionHeader className="px-1" title="Details" />
        <Card>
          <dl className="divide-hairline divide-y">
            <Row label="Goal">
              {goal ? (
                <span className="flex items-center justify-end gap-1.5">
                  <span
                    aria-hidden="true"
                    className={cn(
                      "border-ink size-3 rounded-[4px] border",
                      tintBackground(goal.tint),
                    )}
                  />
                  {goal.name}
                </span>
              ) : (
                <span className="text-text-secondary">No goal</span>
              )}
            </Row>
            <Row label="Platform or bank">
              {investment.platform ?? <span className="text-text-secondary">None</span>}
            </Row>
            <Row label="Folio or account no.">
              {investment.folio ? (
                <span className="tabular-nums">{investment.folio}</span>
              ) : (
                <span className="text-text-secondary">None</span>
              )}
            </Row>
            {investment.note ? <Row label="Note">{investment.note}</Row> : null}
          </dl>
        </Card>
      </section>

      <section aria-label="Entries" className="space-y-1.5">
        <SectionHeader className="px-1" title="Entries" count={items.length} />
        {items.length === 0 ? (
          <p className="text-text-secondary bg-surface rounded-card border border-dashed px-4 py-6 text-center text-sm">
            {schedule && open
              ? `Nothing yet. The first instalment posts on ${next ? formatDay(next) : "its date"}.`
              : "Nothing yet. Add what you invested with Invest."}
          </p>
        ) : (
          <ListCard>
            {items.map((entry) => {
              const edit = () => setEntrySheet({ entry, type: entry.type });
              const remove = () => setConfirm({ entry });
              return (
                <li key={entry.id}>
                  <ListRow
                    onClick={edit}
                    leading={
                      <span
                        aria-hidden="true"
                        className={cn(
                          "rounded-control text-text flex size-9 items-center justify-center",
                          entry.type === "invest" ? "bg-tint-mint" : "bg-tint-peach",
                        )}
                      >
                        {entry.type === "invest" ? (
                          <ArrowDownLeft className="size-4" />
                        ) : (
                          <ArrowUpRight className="size-4" />
                        )}
                      </span>
                    }
                    title={entry.type === "invest" ? "Invested" : "Redeemed"}
                    titleBadge={entry.scheduled ? <Pill>Auto</Pill> : null}
                    subtitle={
                      <span className="truncate">
                        {formatDay(entry.occurredOn)}
                        {entry.units !== null
                          ? ` · ${entry.units} units${
                              entry.price !== null
                                ? ` at ${formatMoney(BigInt(entry.price))}`
                                : ""
                            }`
                          : ""}
                        {entry.note ? ` · ${entry.note}` : ""}
                      </span>
                    }
                    trailing={
                      <span className={entry.type === "redeem" ? "text-income" : undefined}>
                        {entry.type === "invest" ? "+" : "−"}
                        <Amount value={BigInt(entry.amount)} signDisplay="never" />
                      </span>
                    }
                    swipeRight={{ label: "Edit", icon: Pencil, onAction: edit }}
                    swipeLeft={{
                      label: "Delete",
                      icon: Trash2,
                      tone: "destructive",
                      onAction: remove,
                    }}
                    menu={[
                      { label: "Edit", icon: Pencil, onAction: edit },
                      {
                        label: "Delete",
                        icon: Trash2,
                        tone: "destructive",
                        onAction: remove,
                      },
                    ]}
                  />
                </li>
              );
            })}
          </ListCard>
        )}
      </section>

      <div className={cn("grid gap-2", open ? "grid-cols-3" : "grid-cols-2")}>
        <Button size="touch" variant="outline" onClick={() => setEditOpen(true)}>
          <Pencil className="size-4" aria-hidden="true" />
          Edit
        </Button>
        {open ? (
          <Button
            size="touch"
            variant="outline"
            disabled={pending}
            onClick={() => setConfirm("close")}
          >
            <Archive className="size-4" aria-hidden="true" />
            Close
          </Button>
        ) : null}
        <Button
          size="touch"
          variant="outline"
          className="text-expense"
          disabled={pending}
          onClick={() => setConfirm("delete")}
        >
          <Trash2 className="size-4" aria-hidden="true" />
          Delete
        </Button>
      </div>

      {entrySheet ? (
        <EntrySheet
          open
          onOpenChange={(next) => !next && setEntrySheet(null)}
          investment={{ ...investment, net }}
          entry={entrySheet.entry}
          initialType={entrySheet.type}
          today={today}
          onSaved={(entry) =>
            startTransition(() => {
              apply({ type: "upsert", entry });
              router.refresh();
            })
          }
        />
      ) : null}

      <InvestmentSheet
        open={editOpen}
        onOpenChange={setEditOpen}
        investment={investment}
        goals={goals}
        today={today}
      />

      <PayoutSheet
        open={payoutOpen}
        onOpenChange={(next) => {
          setPayoutOpen(next);
          // Leave the ?payout=1 behind, so a refresh does not reopen it.
          if (!next && openPayout) router.replace(`/investments/${investment.id}`);
        }}
        investment={investment}
        today={today}
      />

      <ConfirmDialog
        open={confirm === "delete"}
        onOpenChange={(next) => !next && setConfirm(null)}
        title={`Delete ${investment.name}?`}
        description={`Its ${items.length} ${items.length === 1 ? "entry goes" : "entries go"} with it. To keep the history, close it instead.`}
        pending={pending}
        onConfirm={async () => {
          const done = await run(
            () => deleteInvestment({ id: investment.id }),
            `${investment.name} deleted.`,
          );
          if (done) router.push("/investments");
        }}
      />

      <ConfirmDialog
        open={confirm === "close"}
        onOpenChange={(next) => !next && setConfirm(null)}
        title={`Close ${investment.name}?`}
        description={
          schedule
            ? "Instalments stop, and it moves to Closed with its history. You can reopen it."
            : "It moves to Closed with its history. You can reopen it."
        }
        confirmLabel="Close"
        tone="default"
        pending={pending}
        onConfirm={async () => {
          const done = await run(
            () => closeInvestment({ id: investment.id, on: today }),
            `${investment.name} closed.`,
          );
          if (done) setConfirm(null);
        }}
      />

      <ConfirmDialog
        open={typeof confirm === "object" && confirm !== null}
        onOpenChange={(next) => !next && setConfirm(null)}
        title="Delete this entry?"
        description={
          typeof confirm === "object" && confirm !== null
            ? `${confirm.entry.type === "invest" ? "Invested" : "Redeemed"} ${formatMoney(BigInt(confirm.entry.amount))} on ${formatDay(confirm.entry.occurredOn)}.${
                confirm.entry.scheduled ? " The schedule will not post it again." : ""
              }`
            : ""
        }
        onConfirm={() => {
          if (typeof confirm === "object" && confirm !== null) {
            removeEntry(confirm.entry);
          }
        }}
      />
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-3 px-4 py-2.5 text-sm">
      <dt className="text-text-secondary shrink-0">{label}</dt>
      <dd className="min-w-0 text-right font-semibold break-words">{children}</dd>
    </div>
  );
}
