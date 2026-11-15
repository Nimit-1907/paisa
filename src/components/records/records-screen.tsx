"use client";

import * as React from "react";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import Link from "next/link";

import {
  ChevronRight,
  Plus,
  Receipt,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { toast } from "sonner";

import {
  createTransaction,
  deleteTransaction,
  loadMoreTransactions,
  restoreTransaction,
  updateTransaction,
} from "@/actions/transactions";
import { EmptyState } from "@/components/shared/empty-state";
import { useCurrency } from "@/components/profile-provider";
import { FiltersSheet } from "@/components/records/filters-sheet";
import { CollapsingHeader } from "@/components/layout/collapsing-header";
import { HeaderAvatar } from "@/components/layout/page-header";
import { InsightStrip } from "@/components/shared/insight-strip";
import { ListCard } from "@/components/shared/surface";
import { MonthRecap } from "@/components/records/month-recap";
import { MonthStrip } from "@/components/records/month-strip";
import { type DaySpend, MonthStar } from "@/components/records/month-star";
import { Amount } from "@/components/shared/amount";
import { SectionHeader } from "@/components/shared/section-header";
import { PullToRefresh } from "@/components/records/pull-to-refresh";
import { UpcomingStrip } from "@/components/records/upcoming-strip";
import type {
  AccountOption,
  CategoryOption,
  RecordSubmit,
} from "@/components/records/record-sheet";
import { useRecordSheet } from "@/components/records/record-sheet-provider";
import { RecordRow } from "@/components/records/record-row";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { evaluate } from "@/lib/calculator";
import { instantToLocal, localToInstant, nowLocal } from "@/lib/dates";
import { fromMinor } from "@/lib/money";
import { dayDifference } from "@/lib/recurrence";
import type { TransactionRow } from "@/lib/queries/transactions";
import type { MonthRecap as MonthRecapData } from "@/lib/queries/recap";
import type { UpcomingOccurrence } from "@/lib/recurring-rule";
import {
  useClearFilters,
  useRemoveFilter,
} from "@/components/records/use-clear-filters";
import { ActiveFilters } from "@/components/records/active-filters";
import { RecordDetail } from "@/components/records/record-detail";
import { SearchOverlay } from "@/components/records/search-overlay";
import type { TransactionFilters } from "@/lib/schemas/transactions";
import { cn } from "@/lib/utils";

type OptimisticAction =
  | { kind: "add"; row: TransactionRow }
  | { kind: "update"; row: TransactionRow }
  | { kind: "delete"; id: string };

export type RecordsScreenProps = {
  year: number;
  month: number;
  timeZone: string;
  rows: TransactionRow[];
  hasMore: boolean;
  summary: { income: string; expense: string; net: string };
  /** One row per day of the month, for the bars on the card. */
  monthDays: DaySpend[];
  /** Last month's expense total, minor units as text, for the trend pill. */
  previousExpense: string;
  /** The signed-in person's name, for the greeting and the avatar. */
  displayName: string;
  /** One plain sentence about the month, or null. */
  insight: string | null;
  /** `yyyy-mm`, for the link behind each bar. */
  monthKey: string;
  accounts: AccountOption[];
  categories: CategoryOption[];
  filters: TransactionFilters;
  activeFilterCount: number;
  /** Scheduled items in the next seven days; empty unless this is this month. */
  upcoming: UpcomingOccurrence[];
  /** Today where the user is, `yyyy-mm-dd`. */
  today: string;
  /** Bounds for the month stepper in the sticky header. */
  monthNav: {
    year: number;
    month: number;
    maxYear: number;
    maxMonth: number;
  };
  /** Last month's recap, on the first open of a new month. */
  recap: MonthRecapData | null;
  /** "October", for the recap heading. */
  recapMonthLabel: string | null;
};

/**
 * The Records tab.
 *
 * Writes go through useOptimistic, so a new row is on screen before the
 * server has answered — on a phone, waiting a round trip per receipt is the
 * difference between logging the day's spending and not bothering.
 */
export function RecordsScreen({
  year,
  month,
  timeZone,
  rows,
  hasMore,
  summary,
  monthDays,
  previousExpense,
  displayName,
  insight,
  monthKey,
  accounts,
  categories,
  filters,
  activeFilterCount,
  upcoming,
  today,
  monthNav,
  recap,
  recapMonthLabel,
}: RecordsScreenProps) {
  const router = useRouter();
  const currency = useCurrency();
  const clearFilters = useClearFilters();
  const removeFilter = useRemoveFilter();
  const sheet = useRecordSheet();
  const pathname = usePathname();
  const params = useSearchParams();

  /**
   * `?add=1` opens the sheet on arrival.
   *
   * It is how the end of setup hands over to the first record: the welcome
   * screen's button is "Add your first expense", and landing on a list with
   * the sheet already open is what makes that sentence true. The parameter
   * is stripped straight away so a refresh or a back button does not reopen
   * it.
   */
  React.useEffect(() => {
    if (params.get("add") !== "1") return;

    sheet.openAdd();

    const rest = new URLSearchParams(params.toString());
    rest.delete("add");
    const query = rest.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const searchOpen = params.get("search") === "1";

  /** Sets or clears `?search=1`, keeping the month and the filters. */
  const setSearchOpen = React.useCallback(
    (next: boolean) => {
      const query = new URLSearchParams(params.toString());
      if (next) query.set("search", "1");
      else query.delete("search");

      const text = query.toString();
      router.replace(text ? `${pathname}?${text}` : pathname, {
        scroll: false,
      });
    },
    [params, pathname, router],
  );

  const [pending, startTransition] = React.useTransition();
  const [loaded, setLoaded] = React.useState(rows);
  const [more, setMore] = React.useState(hasMore);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [filtersOpen, setFiltersOpen] = React.useState(false);
  /** The record whose detail sheet is open, by id. */
  const [detailId, setDetailId] = React.useState<string | null>(null);

  // Ids the user has deleted, so a refresh that still carries them (or a
  // page loaded earlier) does not put them back.
  const deleted = React.useRef(new Set<string>());

  /**
   * The pull-to-refresh in flight, if there is one.
   *
   * `pending` is the only signal that router.refresh() has come back, and it
   * is false both before the transition starts and after it ends — so the
   * resolver waits for it to have been true at least once. The timer belongs
   * to this refresh alone, so a second pull cannot be ended by the first
   * one's clock.
   */
  const refreshing = React.useRef<{
    resolve: () => void;
    started: boolean;
    timers: number[];
  } | null>(null);

  // Two keys, because a refresh means two different things. Changing month or
  // filters is a different list: start again. Everything else — a save, a
  // delete, an edit — is the same list with newer contents, and replacing it
  // wholesale would throw away every page the user had scrolled through.
  const scopeKey = `${year}-${month}-${JSON.stringify(filters)}`;
  const contentKey = rows
    .map((row) =>
      [
        row.id,
        row.amount,
        row.occurredAt,
        row.categoryId,
        row.accountId,
        row.note,
      ].join(":"),
    )
    .join("|");

  React.useEffect(() => {
    deleted.current.clear();
    setLoaded(rows);
    setMore(hasMore);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeKey]);

  React.useEffect(() => {
    setLoaded((current) => mergeRows(rows, current, deleted.current));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentKey]);

  const [visible, applyOptimistic] = React.useOptimistic(
    loaded,
    (state: TransactionRow[], action: OptimisticAction) => {
      switch (action.kind) {
        case "add":
          return [action.row, ...state].sort(byNewest);
        case "update":
          return state
            .map((row) => (row.id === action.row.id ? action.row : row))
            .sort(byNewest);
        case "delete":
          return state.filter((row) => row.id !== action.id);
      }
    },
  );

  /**
   * Saving on behalf of the shared sheet.
   *
   * Registered while this screen is mounted, so a record added from the FAB
   * lands in this list optimistically instead of only after a refresh.
   */
  const submit = React.useCallback<RecordSubmit>(
    (values, context) =>
      new Promise((resolve) => {
        startTransition(async () => {
          try {
            // Inside the try: building the row touches crypto and the
            // calendar, and a throw out here would leave this promise
            // unsettled and the sheet stuck on "Saving…".
            const optimistic = toOptimisticRow(
              values,
              context.editingId,
              accounts,
              categories,
              timeZone,
              currency.decimals,
            );

            if (optimistic) {
              applyOptimistic(
                context.editingId
                  ? { kind: "update", row: optimistic }
                  : { kind: "add", row: optimistic },
              );
            }

            const result = context.editingId
              ? await updateTransaction({ ...values, id: context.editingId })
              : await createTransaction(values);

            if (result.ok) {
              // Into `loaded` as well, under the id the server gave it. The
              // merge effect watches the first page, and a record edited on
              // a later page — or edited so it leaves the first page —
              // would otherwise snap back when the optimistic state settles.
              if (optimistic) {
                setLoaded((current) =>
                  mergeRows(
                    [{ ...optimistic, id: result.data.id }],
                    current,
                    deleted.current,
                  ),
                );
              }

              router.refresh();
            }

            resolve(result);
          } catch (thrown) {
            // Without this the sheet's save promise never settles and it
            // sits on "Saving…" for ever.
            console.error("[records]", thrown);
            router.refresh();
            resolve({
              ok: false,
              error: "Could not save. Check your connection and try again.",
            });
          }
        });
      }),
    [
      accounts,
      categories,
      timeZone,
      currency.decimals,
      applyOptimistic,
      router,
    ],
  );

  React.useEffect(() => sheet.setSubmitHandler(submit), [sheet, submit]);

  const remove = React.useCallback(
    (record: TransactionRow) => {
      startTransition(async () => {
        deleted.current.add(record.id);
        applyOptimistic({ kind: "delete", id: record.id });
        // Taken out of the loaded list too: a row from a later page would
        // otherwise come straight back when the optimistic state settles,
        // because the first page — and so the content key — never changed.
        setLoaded((current) => current.filter((row) => row.id !== record.id));

        // Puts the row back where it was. Without this a refused delete
        // leaves the record on the server but missing from the list, which
        // is the one outcome worse than not deleting it.
        const putBack = () => {
          deleted.current.delete(record.id);
          setLoaded((current) => mergeRows([record], current, deleted.current));
          router.refresh();
        };

        let result;
        try {
          result = await deleteTransaction({ id: record.id });
        } catch (thrown) {
          console.error("[records]", thrown);
          toast.error("Could not delete that. Check your connection.");
          putBack();
          return;
        }

        if (!result.ok) {
          toast.error(result.error);
          putBack();
          return;
        }

        router.refresh();

        toast("Record deleted", {
          duration: 5000,
          action: {
            label: "Undo",
            onClick: () => {
              startTransition(async () => {
                deleted.current.delete(record.id);
                applyOptimistic({ kind: "add", row: record });
                setLoaded((current) =>
                  mergeRows([record], current, deleted.current),
                );

                try {
                  const undone = await restoreTransaction({
                    id: record.id,
                    type: record.type,
                    // Back to decimal text, which is what the action parses.
                    amount: fromMinor(BigInt(record.amount), currency.decimals),
                    accountId: record.accountId,
                    toAccountId: record.toAccountId,
                    categoryId: record.categoryId,
                    note: record.note,
                    occurredAt: instantToLocal(record.occurredAt, timeZone),
                    recurringRuleId: record.recurringRuleId,
                  });

                  if (!undone.ok) toast.error(undone.error);
                } catch (thrown) {
                  console.error("[records]", thrown);
                  toast.error("Could not undo that. Check your connection.");
                } finally {
                  router.refresh();
                }
              });
            },
          },
        });
      });
    },
    [currency.decimals, timeZone, applyOptimistic, router],
  );

  const removeById = React.useCallback(
    (id: string) => {
      const record = loaded.find((row) => row.id === id);
      if (record) remove(record);
    },
    [loaded, remove],
  );

  React.useEffect(
    () => sheet.setDeleteHandler(removeById),
    [sheet, removeById],
  );

  async function loadMore() {
    if (loadingMore || !more) return;

    const retry = { label: "Try again", onClick: () => void loadMore() };

    setLoadingMore(true);

    try {
      // Counted from what is on screen rather than a stored offset: a delete
      // or an add shifts the server's ordering, and a stale offset would skip
      // a record for good.
      const result = await loadMoreTransactions({
        year,
        month,
        offset: loaded.length,
        filters,
      });

      if (!result.ok) {
        toast.error(result.error, { action: retry });
        return;
      }

      setLoaded((current) =>
        mergeRows(current, result.data.rows, deleted.current),
      );
      setMore(result.data.hasMore);
    } catch (thrown) {
      console.error("[records]", thrown);
      // Never a dead end: the page that failed is still the next page, so
      // the only thing to offer is another go at it.
      toast.error("Could not load more records.", { action: retry });
    } finally {
      setLoadingMore(false);
    }
  }

  const days = React.useMemo(
    () => groupByDay(visible, timeZone, today),
    [visible, timeZone, today],
  );

  /*
   * Held by id rather than by value.
   *
   * The record behind an open detail sheet can change underneath it — an
   * edit saved from the sheet, a refresh landing, the row deleted in
   * another tab. Looking it up each render means the sheet shows what is
   * true now, and closes itself when the row is gone rather than showing a
   * record that no longer exists.
   */
  const detail = detailId
    ? (visible.find((row) => row.id === detailId) ?? null)
    : null;

  /** Records in the same category, which is what "similar" means here. */
  const showSimilar = React.useCallback(
    (record: TransactionRow) => {
      setDetailId(null);
      if (!record.categoryId) return;
      router.push(`/records?m=${monthKey}&category=${record.categoryId}`);
    },
    [monthKey, router],
  );

  /** Opens a new record pre-filled from an existing one. */
  const copyOf = React.useCallback(
    (record: TransactionRow) => {
      setDetailId(null);
      sheet.openCopy({
        ...draftOf(record),
        // Today, not the original date: a duplicate is almost always "the
        // same thing again, now".
        occurredAtLocal: nowLocal(timeZone),
        // The copy is its own record, not another instance of a rule.
        recurringRuleId: null,
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sheet, timeZone],
  );

  /*
   * How much of the month is left, counted from the days the card draws.
   *
   * From `monthDays` rather than from a calendar: that array already has one
   * entry per day of the month the user is looking at, so this cannot
   * disagree with the bars above it — and on a past month `today` is not in
   * it, which is exactly when the per-day line should not appear.
   */
  /*
   * "Good evening, Aarav".
   *
   * Computed on the client from the device clock rather than passed down
   * from the server: a page rendered at 5pm and read at 9pm would otherwise
   * greet somebody with the wrong part of their day, and this is the one
   * string on the screen where that is obvious.
   */
  const [greeting, setGreeting] = React.useState("Welcome back");

  React.useEffect(() => {
    const hour = new Date().getHours();
    const part =
      hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
    const name = displayName.split(/\s+/)[0];
    setGreeting(name ? `${part}, ${name}` : part);
  }, [displayName]);

  /** "Oct" — the month the trend pill compares against. */
  const previousLabel = React.useMemo(
    () =>
      new Intl.DateTimeFormat("en-IN", {
        timeZone: "UTC",
        month: "short",
      }).format(new Date(Date.UTC(year, month - 2, 1))),
    [year, month],
  );

  const daysLeft = React.useMemo(() => {
    const index = monthDays.findIndex((day) => day.on === today);
    return index < 0 ? 0 : monthDays.length - index;
  }, [monthDays, today]);

  /**
   * "12% less than Oct", or nothing.
   *
   * Nothing when last month had no spending: every amount is an increase
   * from zero, and "+∞%" is not a thing to put on a card. Nothing either
   * when the difference rounds to zero, because "0% less than Oct" is a
   * sentence that cost somebody a second to read and told them nothing.
   */
  const trend = React.useMemo(() => {
    const previous = BigInt(previousExpense);
    if (previous <= 0n) return null;

    const current = BigInt(summary.expense);

    // Rounded, not truncated. BigInt division floors toward zero, so a
    // 12.9% rise read as 12% and a 0.9% one read as 0 and hid the pill
    // altogether. The ratio is small enough that Number is exact here.
    const percent = Math.round(
      (Number(current - previous) * 100) / Number(previous),
    );
    if (percent === 0) return null;

    const less = percent < 0;
    return {
      better: less,
      text: `${Math.abs(percent)}% ${less ? "less" : "more"} than ${previousLabel}`,
    };
  }, [previousExpense, summary.expense, previousLabel]);

  /** A record as the sheet's draft. Shared by Edit and Duplicate. */
  const draftOf = React.useCallback(
    (record: TransactionRow) => ({
      id: record.id,
      type: record.type,
      amount: record.amount,
      accountId: record.accountId,
      toAccountId: record.toAccountId,
      categoryId: record.categoryId,
      note: record.note,
      occurredAtLocal: instantToLocal(record.occurredAt, timeZone),
      recurringRuleId: record.recurringRuleId,
    }),
    [timeZone],
  );

  /*
   * A refresh that finishes when the refresh finishes.
   *
   * router.refresh() returns nothing, so the only signal that the server's
   * answer has arrived and painted is the transition going from pending back
   * to idle. The resolver is parked in a ref and called by the effect below,
   * which is what keeps the pull indicator up for exactly as long as the
   * work takes rather than for an arbitrary moment.
   */
  const settle = React.useCallback(() => {
    const current = refreshing.current;
    if (!current) return;

    for (const timer of current.timers) window.clearTimeout(timer);
    refreshing.current = null;
    current.resolve();
  }, []);

  const refresh = React.useCallback(
    () =>
      new Promise<void>((resolve) => {
        // A pull while one is already running joins it rather than starting
        // a second.
        settle();

        refreshing.current = {
          resolve,
          started: false,
          timers: [
            /*
             * Two fallbacks, for two different failures.
             *
             * A transition with nothing to fetch can finish before React
             * ever reports it as pending, and then the effect below has
             * nothing to react to — so after a beat, if it never started,
             * the refresh is already over.
             */
            window.setTimeout(() => {
              if (refreshing.current && !refreshing.current.started) settle();
            }, 600),

            // And a ceiling, for a transition that starts and never ends.
            window.setTimeout(settle, 10_000),
          ],
        };

        startTransition(() => router.refresh());
      }),
    [router, settle],
  );

  React.useEffect(() => {
    const current = refreshing.current;
    if (!current) return;

    if (pending) {
      current.started = true;
      return;
    }

    if (current.started) settle();
  }, [pending, settle]);

  return (
    <PullToRefresh onRefresh={refresh}>
      <CollapsingHeader
        title="Records"
        greeting={greeting}
        monthNav={monthNav}
        compact={<MonthStrip summary={summary} />}
        actions={
          <>
            <Button
              variant="ghost"
              size="icon-touch"
              aria-label="Search records"
              onClick={() => setSearchOpen(true)}
            >
              <Search className="size-5" aria-hidden="true" />
            </Button>
            <HeaderAvatar name={displayName} />
          </>
        }
      >
        <div className="space-y-4">
          {recap && recapMonthLabel ? (
            <MonthRecap recap={recap} monthLabel={recapMonthLabel} />
          ) : null}

          <MonthStar
            summary={summary}
            days={monthDays}
            today={today}
            daysLeft={daysLeft}
            trend={trend}
            // The recap takes the accent on the one day it appears.
            flat={Boolean(recap && recapMonthLabel)}
          />

          <InsightStrip>{insight}</InsightStrip>
        </div>
      </CollapsingHeader>

      <div className="mt-4 space-y-4">
        <UpcomingStrip items={upcoming} today={today} />

        <SectionHeader
          className="px-1"
          title={`${visible.length}${more ? "+" : ""} ${
            visible.length === 1 ? "record" : "records"
          }`}
          trailing={
            <Button
              variant={activeFilterCount > 0 ? "default" : "ghost"}
              size="touch"
              className="-my-2 px-3"
              onClick={() => setFiltersOpen(true)}
            >
              <SlidersHorizontal className="size-4" aria-hidden="true" />
              {activeFilterCount > 0
                ? `Filters · ${activeFilterCount}`
                : "Filter"}
            </Button>
          }
        />

        <ActiveFilters
          filters={filters}
          accounts={accounts}
          categories={categories}
          onRemove={removeFilter}
          onClearAll={clearFilters}
        />

        {visible.length === 0 ? (
          <EmptyState
            art="records"
            icon={Receipt}
            title={
              activeFilterCount > 0
                ? "Nothing matches those filters"
                : "No records this month"
            }
            description={
              activeFilterCount > 0
                ? "Try widening the search, or clear the filters to see everything again."
                : "Expenses, income and transfers you log will be listed here, newest first."
            }
            action={
              activeFilterCount > 0 ? (
                <Button variant="outline" size="touch" onClick={clearFilters}>
                  Clear filters
                </Button>
              ) : (
                <Button size="touch" onClick={() => sheet.openAdd()}>
                  <Plus className="size-4" aria-hidden="true" />
                  Add record
                </Button>
              )
            }
          />
        ) : (
          <div className="space-y-4">
            {days.map((day) => (
              <section key={day.key} aria-label={day.label}>
                <div className="mb-1.5 flex items-baseline justify-between gap-2 px-1">
                  <h2 className="min-w-0">
                    {/*
                    The day heading is the way into a single day. It used to
                    be the bars on the card above, which were seven pixels
                    wide; this is the same destination with a target you can
                    actually hit.
                  */}
                    <Link
                      href={`/records?m=${monthKey}&from=${day.key}&to=${day.key}`}
                      className="text-text hoverable:text-text-secondary rounded-control inline-flex min-h-11 items-center gap-1 text-sm font-semibold"
                    >
                      {day.label}
                      <ChevronRight className="size-3.5" aria-hidden="true" />
                    </Link>
                  </h2>
                  {/* Through `Amount` like every other figure, so the day's
                      total trims its paise on the same rule the rows below
                      it do — the two disagreeing is worse than either. */}
                  {day.net === 0n ? null : (
                    <span
                      className={cn(
                        "text-xs font-semibold",
                        day.net > 0n ? "text-income" : "text-text-secondary",
                      )}
                    >
                      <Amount value={day.net} signDisplay="always" />
                    </span>
                  )}
                </div>

                <ListCard>
                  {day.rows.map((record) => (
                    <li key={record.id}>
                      <RecordRow
                        record={record}
                        pending={record.id.startsWith("optimistic-")}
                        highlight={record.id === sheet.lastSavedId}
                        // Tapping opens the detail; the menu's Edit is the
                        // fast path for people who know it is there.
                        onOpen={() => setDetailId(record.id)}
                        onEdit={() => sheet.openEdit(draftOf(record))}
                        onCopy={() => copyOf(record)}
                        onShowSimilar={
                          record.categoryId
                            ? () => showSimilar(record)
                            : undefined
                        }
                        onDelete={() => remove(record)}
                      />
                    </li>
                  ))}
                </ListCard>
              </section>
            ))}

            {more ? (
              <LoadMore onVisible={loadMore} loading={loadingMore} />
            ) : null}
          </div>
        )}

        <RecordDetail
          record={detail}
          timeZone={timeZone}
          onOpenChange={(next) => {
            if (!next) setDetailId(null);
          }}
          onEdit={() => {
            if (!detail) return;
            setDetailId(null);
            sheet.openEdit(draftOf(detail));
          }}
          onCopy={() => detail && copyOf(detail)}
          onShowSimilar={
            detail?.categoryId ? () => showSimilar(detail) : undefined
          }
          onDelete={() => {
            if (!detail) return;
            setDetailId(null);
            remove(detail);
          }}
        />

        <SearchOverlay
          open={searchOpen}
          initialQuery={filters.search ?? ""}
          categories={categories}
          monthKey={monthKey}
          onClose={() => setSearchOpen(false)}
          onSearch={(term) => {
            const query = new URLSearchParams(params.toString());
            query.delete("search");
            if (term) query.set("q", term);
            else query.delete("q");
            router.replace(`${pathname}?${query.toString()}`, {
              scroll: false,
            });
          }}
          onFilter={(extra) => {
            const query = new URLSearchParams(params.toString());
            query.delete("search");
            for (const [key, value] of Object.entries(extra)) {
              query.set(key, value);
            }
            router.replace(`${pathname}?${query.toString()}`, {
              scroll: false,
            });
          }}
        />

        <FiltersSheet
          open={filtersOpen}
          onOpenChange={setFiltersOpen}
          accounts={accounts}
          categories={categories}
          filters={filters}
        />
      </div>
    </PullToRefresh>
  );
}

/** Loads the next page when the sentinel scrolls into view. */
function LoadMore({
  onVisible,
  loading,
}: {
  onVisible: () => void;
  loading: boolean;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const handler = React.useRef(onVisible);
  handler.current = onVisible;

  React.useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) handler.current();
      },
      // Start fetching before it is actually on screen, so the list rarely
      // shows the skeleton at all.
      { rootMargin: "320px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} aria-live="polite" className="space-y-2">
      {loading ? (
        <>
          <Skeleton className="rounded-card h-16" />
          <Skeleton className="rounded-card h-16" />
        </>
      ) : (
        <Skeleton className="h-16 rounded-control opacity-50" />
      )}
      <span className="sr-only">Loading more records</span>
    </div>
  );
}

const byNewest = (a: TransactionRow, b: TransactionRow) =>
  b.occurredAt.localeCompare(a.occurredAt) || b.id.localeCompare(a.id);

/**
 * Merges two lists of rows by id, newest first.
 *
 * The first list wins where both have a row, which is how a refreshed first
 * page updates what is on screen without discarding the pages below it.
 */
function mergeRows(
  preferred: TransactionRow[],
  existing: TransactionRow[],
  deleted: Set<string>,
): TransactionRow[] {
  const byId = new Map<string, TransactionRow>();

  for (const row of existing) byId.set(row.id, row);
  for (const row of preferred) byId.set(row.id, row);

  return [...byId.values()]
    .filter((row) => !deleted.has(row.id))
    .sort(byNewest);
}

// Intl formatters are expensive to build, and the timezone rarely changes.
const dayFormatters = new Map<
  string,
  { day: Intl.DateTimeFormat; label: Intl.DateTimeFormat }
>();

function formattersFor(timeZone: string) {
  const cached = dayFormatters.get(timeZone);
  if (cached) return cached;

  const made = {
    day: new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }),
    label: new Intl.DateTimeFormat("en-IN", {
      timeZone,
      weekday: "short",
      day: "numeric",
      month: "short",
    }),
  };

  dayFormatters.set(timeZone, made);
  return made;
}

/** Groups rows under a local day, with that day's net. */
/**
 * The day headings in the list.
 *
 * "Today" and "Yesterday" by name, because that is how anybody scanning what
 * they spent thinks about the last two days; anything older gets its date,
 * which is what you need once "how long ago" stops being obvious.
 */
function groupByDay(rows: TransactionRow[], timeZone: string, today: string) {
  const { day: dayFormatter, label: labelFormatter } = formattersFor(timeZone);

  const groups = new Map<
    string,
    { key: string; label: string; rows: TransactionRow[]; net: bigint }
  >();

  for (const row of rows) {
    const date = new Date(row.occurredAt);
    const key = dayFormatter.format(date);

    const group = groups.get(key) ?? {
      key,
      label: relativeDayHeading(key, today, labelFormatter.format(date)),
      rows: [],
      net: 0n,
    };

    group.rows.push(row);

    // A transfer moves money between the user's own accounts, so it nets to
    // nothing on the day — counting it would double the day's activity.
    if (row.type === "income") group.net += BigInt(row.amount);
    if (row.type === "expense") group.net -= BigInt(row.amount);

    groups.set(key, group);
  }

  return [...groups.values()];
}

/** "Today", "Yesterday", or the date it already had. */
function relativeDayHeading(day: string, today: string, fallback: string) {
  if (day === today) return "Today";
  if (dayDifference(today, day) === -1) return "Yesterday";

  return fallback;
}

/** A row good enough to show while the server catches up. */
function toOptimisticRow(
  values: {
    type: TransactionRow["type"];
    amount: string;
    accountId: string;
    toAccountId: string | null;
    categoryId: string | null;
    note: string | null;
    occurredAt: string;
  },
  editingId: string | null,
  accounts: AccountOption[],
  categories: CategoryOption[],
  timeZone: string,
  decimals: number,
): TransactionRow | null {
  const account = accounts.find((item) => item.id === values.accountId);
  const toAccount = accounts.find((item) => item.id === values.toAccountId);
  const category = categories.find((item) => item.id === values.categoryId);

  const occurred = localToInstant(values.occurredAt, timeZone);
  if (!occurred) return null;

  // The same evaluation the server will do, so the placeholder row shows the
  // amount that is about to be saved rather than an approximation of it.
  const calculated = evaluate(values.amount, decimals);
  if (!calculated.ok) return null;

  return {
    id: editingId ?? `optimistic-${temporaryId()}`,
    type: values.type,
    amount: calculated.minor.toString(),
    note: values.note,
    occurredAt: occurred.toISOString(),
    accountId: values.accountId,
    accountName: account?.name ?? "",
    toAccountId: values.toAccountId,
    toAccountName: toAccount?.name ?? null,
    categoryId: values.categoryId,
    categoryName: category?.name ?? null,
    categoryIcon: category?.icon ?? null,
    categoryColor: category?.color ?? null,
    categoryTint: category?.tint ?? null,
    recurringRuleId: null,
  };
}

/**
 * An id for a row that only exists until the server answers.
 *
 * crypto.randomUUID is only defined in a secure context, and a phone loading
 * the app over plain HTTP on the LAN is not one — which is exactly how this
 * gets tested on a real device.
 */
function temporaryId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
