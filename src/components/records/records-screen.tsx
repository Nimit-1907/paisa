"use client";

import * as React from "react";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import Link from "next/link";

import { Plus, Receipt, SlidersHorizontal } from "lucide-react";
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
import { ListCard } from "@/components/shared/surface";
import { MonthStrip } from "@/components/records/month-strip";
import { type DaySpend, MonthStar } from "@/components/records/month-star";
import { SectionHeader } from "@/components/shared/section-header";
import { PullToRefresh } from "@/components/records/pull-to-refresh";
import type {
  AccountOption,
  CategoryOption,
  RecordSubmit,
} from "@/components/records/record-sheet";
import { useRecordSheet } from "@/components/records/record-sheet-provider";
import { QuickEntry } from "@/components/records/quick-entry";
import { RecordRow } from "@/components/records/record-row";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { parseAmount } from "@/lib/amount";
import { instantToLocal, localToInstant } from "@/lib/dates";
import { fromMinor } from "@/lib/money";
import { comparedWith } from "@/lib/month-trend";
import { railDate } from "@/lib/ledger";
import { dayDifference } from "@/lib/recurrence";
import type { TransactionRow } from "@/lib/queries/transactions";
import {
  useClearFilters,
  useRemoveFilter,
} from "@/components/records/use-clear-filters";
import { ActiveFilters } from "@/components/records/active-filters";
import { logAgainDraft, draftOf as toDraft } from "@/lib/record-draft";
import {
  RecordDetail,
  RecordDetailPanel,
} from "@/components/records/record-detail";
import { useIsDesktop } from "@/hooks/use-media-query";
import { SearchOverlay } from "@/components/records/search-overlay";
import type { TransactionFilters } from "@/lib/schemas/transactions";

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
  /** Minor units marked "not worth it" this month, as text. */
  regret: string;
  /** `yyyy-mm`, for the link behind each bar. */
  monthKey: string;
  accounts: AccountOption[];
  categories: CategoryOption[];
  filters: TransactionFilters;
  activeFilterCount: number;
  /** Today where the user is, `yyyy-mm-dd`. */
  today: string;
  /** Bounds for the month stepper in the sticky header. */
  monthNav: {
    year: number;
    month: number;
    maxYear: number;
    maxMonth: number;
  };
};

/**
 * The Records tab.
 *
 * Writes go through useOptimistic, so a new row is on screen before the
 * server has answered, on a phone, waiting a round trip per receipt is the
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
  regret,
  monthKey,
  accounts,
  categories,
  filters,
  activeFilterCount,
  today,
  monthNav,
}: RecordsScreenProps) {
  const router = useRouter();
  const currency = useCurrency();
  const clearFilters = useClearFilters();
  const removeFilter = useRemoveFilter();
  const sheet = useRecordSheet();
  const isDesktop = useIsDesktop();
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
   * is false both before the transition starts and after it ends, so the
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
  // filters is a different list: start again. Everything else, a save, a
  // delete, an edit, is the same list with newer contents, and replacing it
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
        // A tag set from the record's sheet changes nothing else.
        String(row.worthIt),
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
  /** The list as shown, for the submit handler, which must not re-create. */
  const visibleRef = React.useRef(visible);
  visibleRef.current = visible;

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
              // An edit keeps the record's "Worth it?"; the sheet does not
              // carry it, the record does.
              context.editingId
                ? (visibleRef.current.find(
                    (row) => row.id === context.editingId,
                  )?.worthIt ?? null)
                : null,
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
              // a later page, or edited so it leaves the first page,
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
        // because the first page, and so the content key, never changed.
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
                    worthIt: record.worthIt,
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

  // The receipt toast's Undo has deleted a record just saved: out of the
  // list, and kept out if a refresh still carries it.
  const forget = React.useCallback((id: string) => {
    deleted.current.add(id);
    setLoaded((current) => current.filter((row) => row.id !== id));
  }, []);

  React.useEffect(() => sheet.setForgetHandler(forget), [sheet, forget]);

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
   * The record behind an open detail sheet can change underneath it, an
   * edit saved from the sheet, a refresh landing, the row deleted in
   * another tab. Looking it up each render means the sheet shows what is
   * true now, and closes itself when the row is gone rather than showing a
   * record that no longer exists.
   */
  const detail = detailId
    ? (visible.find((row) => row.id === detailId) ?? null)
    : null;

  /** "Jul", for the card's label on a month that is over. */
  const monthName = new Intl.DateTimeFormat("en-IN", {
    timeZone: "UTC",
    month: "short",
  }).format(new Date(Date.UTC(year, month - 1, 1)));

  /** "1–17 Oct", what the trend pill compares against. */
  const previousLabel = comparedWith(year, month, today);

  /*
   * How much of the month is left, counted from the days the card draws.
   *
   * From `monthDays` rather than from a calendar: that array already has one
   * entry per day of the month the user is looking at, so this cannot
   * disagree with the bars above it, and on a past month `today` is not in
   * it, which is exactly when the per-day line should not appear.
   */
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

    /*
     * Past a tripling, a percentage stops being a comparison and becomes a
     * number to decode: one outlier record against a quiet previous month
     * produced "247101% more than Oct", six digits of noise in a pill built
     * for four characters. A multiple is the same fact in a shape a glance
     * can take. Only the rising side needs it, spending cannot fall by
     * more than 100%.
     */
    if (percent > 200) {
      const times = Math.round(Number(current) / Number(previous));
      return { better: false, text: `${times}× ${previousLabel}` };
    }

    return {
      better: less,
      text: `${Math.abs(percent)}% ${less ? "less" : "more"} than ${previousLabel}`,
    };
  }, [previousExpense, summary.expense, previousLabel]);

  /** A record as the sheet's draft. Shared by Edit and Log again. */
  const draftOf = React.useCallback(
    (record: TransactionRow) => toDraft(record, timeZone),
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
             * nothing to react to, so after a beat, if it never started,
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
      {/* On a wide screen, the list on the left and the record it is
          showing on the right. Below lg this is one column, as before. */}
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-6">
        <div className="min-w-0">
          <CollapsingHeader
            title="Records"
            description="Income, expenses, transfers"
            monthNav={monthNav}
            compact={<MonthStrip summary={summary} />}
            onSearch={() => setSearchOpen(true)}
          >
            <div className="space-y-4">
              {/* The month card and nothing above it. A recap of last month and
              a sentence about this one used to sit around it; both were
              commentary on a screen whose job is the records themselves.
              The sentence still lives on Analysis, where it belongs. */}
              <MonthStar
                summary={summary}
                days={monthDays}
                today={today}
                daysLeft={daysLeft}
                trend={trend}
                pastMonth={daysLeft > 0 ? null : monthName}
                regret={regret}
                regretHref={`/records?m=${monthKey}&worth=regret`}
              />
            </div>
          </CollapsingHeader>

          <div className="mt-4 space-y-4">
            {/* Records are dated now, so only on the month that is running. */}
            {daysLeft > 0 ? <QuickEntry timeZone={timeZone} /> : null}

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
                icon={Receipt}
                title={
                  activeFilterCount > 0
                    ? "Nothing matches those filters"
                    : daysLeft > 0
                      ? "No records this month"
                      : `No records in ${monthName}`
                }
                description={
                  activeFilterCount > 0
                    ? "Try widening the search, or clear the filters to see everything again."
                    : "Expenses, income and transfers you log will be listed here, newest first."
                }
                action={
                  activeFilterCount > 0 ? (
                    <Button
                      variant="outline"
                      size="touch"
                      onClick={clearFilters}
                    >
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
                {/*
              The month as a ledger, the khata's layout: the date in a margin
              on the left, every record of that day beside it. One card for the
              whole month rather than a card per day, which at one record a
              day spent more height on headings than on records.
            */}
                <ListCard as="div">
                  {days.map((day) => {
                    const rail = railDate(day.key);
                    return (
                      <section
                        key={day.key}
                        aria-label={day.label}
                        className="flex"
                      >
                        {/* The date is the way into a single day, a 48px
                        target rather than the card's calendar alone. */}
                        <h2 className="border-hairline w-12 shrink-0 border-r">
                          <Link
                            href={`/records?m=${monthKey}&from=${day.key}&to=${day.key}`}
                            className="hoverable:bg-surface-muted flex h-full min-h-14 w-full flex-col items-center pt-3"
                          >
                            <span className="text-text text-lg leading-none font-bold tabular-nums">
                              {rail.date}
                            </span>
                            {/* Heard as "17 Tue", not "17Tue". */}{" "}
                            {/* The weekday on every day, today included:
                                the section's own label already says Today. */}
                            <span className="text-text-secondary mt-1 text-xs">
                              {rail.weekday}
                            </span>
                            {/* The name starts with what is on screen, "17
                            Tue", as WCAG 2.5.3 asks; the section around it
                            carries the full date. */}
                            <span className="sr-only">
                              , show this day only
                            </span>
                          </Link>
                        </h2>

                        <div className="min-w-0 flex-1">
                          <ul className="divide-hairline divide-y">
                            {day.rows.map((record) => (
                              <li key={record.id}>
                                <RecordRow
                                  dense
                                  record={record}
                                  pending={record.id.startsWith("optimistic-")}
                                  highlight={record.id === sheet.lastSavedId}
                                  selected={isDesktop && record.id === detailId}
                                  // Tapping opens the detail; the menu's Edit is
                                  // the fast path for people who know it is there.
                                  onOpen={() => setDetailId(record.id)}
                                  onEdit={() => sheet.openEdit(draftOf(record))}
                                  onLogAgain={() =>
                                    sheet.openLogAgain(
                                      logAgainDraft(
                                        record,
                                        timeZone,
                                        new Date(),
                                      ),
                                    )
                                  }
                                  onDelete={() => remove(record)}
                                />
                              </li>
                            ))}
                          </ul>
                        </div>
                      </section>
                    );
                  })}
                </ListCard>

                {more ? (
                  <LoadMore onVisible={loadMore} loading={loadingMore} />
                ) : null}
              </div>
            )}

            <RecordDetail
              // On a wide screen the panel shows it; the sheet stays shut.
              record={isDesktop ? null : detail}
              timeZone={timeZone}
              onOpenChange={(next) => {
                if (!next) setDetailId(null);
              }}
              onEdit={() => {
                if (!detail) return;
                setDetailId(null);
                sheet.openEdit(draftOf(detail));
              }}
              onLogAgain={() => {
                if (!detail) return;
                setDetailId(null);
                sheet.openLogAgain(logAgainDraft(detail, timeZone, new Date()));
              }}
              onDelete={() => {
                if (!detail) return;
                setDetailId(null);
                remove(detail);
              }}
            />

            <SearchOverlay
              open={searchOpen}
              initialQuery={filters.search ?? ""}
              timeZone={timeZone}
              onClose={() => setSearchOpen(false)}
            />

            <FiltersSheet
              open={filtersOpen}
              onOpenChange={setFiltersOpen}
              accounts={accounts}
              categories={categories}
              filters={filters}
              monthKey={monthKey}
              today={today}
            />
          </div>
        </div>

        {isDesktop ? (
          // Sticky on the grid cell itself: on the panel inside it, the
          // cell is exactly as tall as the panel, with nowhere to stick.
          <div className="sticky top-6 pt-6">
            <RecordDetailPanel
              record={detail}
              timeZone={timeZone}
              onClose={() => setDetailId(null)}
              onEdit={() => {
                if (!detail) return;
                sheet.openEdit(draftOf(detail));
              }}
              onLogAgain={() => {
                if (!detail) return;
                sheet.openLogAgain(logAgainDraft(detail, timeZone, new Date()));
              }}
              onDelete={() => {
                if (!detail) return;
                setDetailId(null);
                remove(detail);
              }}
            />
          </div>
        ) : null}
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
    // nothing on the day, counting it would double the day's activity.
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
  worthIt: boolean | null,
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
  const calculated = parseAmount(values.amount, decimals);
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
    categoryTint: category?.tint ?? null,
    // Neither is known until the server has written the row: a repeat set
    // up in the sheet creates its rule on the server, and this placeholder
    // is gone before that answer comes back.
    recurringRuleId: null,
    recurringFrequency: null,
    worthIt,
  };
}

/**
 * An id for a row that only exists until the server answers.
 *
 * crypto.randomUUID is only defined in a secure context, and a phone loading
 * the app over plain HTTP on the LAN is not one, which is exactly how this
 * gets tested on a real device.
 */
function temporaryId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
