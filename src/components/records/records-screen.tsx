"use client";

import * as React from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { Plus, Receipt, Repeat, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";

import {
  createTransaction,
  deleteTransaction,
  loadMoreTransactions,
  restoreTransaction,
  updateTransaction,
} from "@/actions/transactions";
import { EmptyState } from "@/components/empty-state";
import { useCurrency, useFormatMoney } from "@/components/profile-provider";
import { FiltersSheet } from "@/components/records/filters-sheet";
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
import { instantToLocal, localToInstant } from "@/lib/dates";
import { fromMinor } from "@/lib/money";
import type { TransactionRow } from "@/lib/queries/transactions";
import type { UpcomingOccurrence } from "@/lib/recurring-rule";
import { useClearFilters } from "@/components/records/use-clear-filters";
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
  accounts: AccountOption[];
  categories: CategoryOption[];
  filters: TransactionFilters;
  activeFilterCount: number;
  /** Scheduled items in the next seven days; empty unless this is this month. */
  upcoming: UpcomingOccurrence[];
  /** Today where the user is, `yyyy-mm-dd`. */
  today: string;
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
  accounts,
  categories,
  filters,
  activeFilterCount,
  upcoming,
  today,
}: RecordsScreenProps) {
  const router = useRouter();
  const currency = useCurrency();
  const clearFilters = useClearFilters();
  const formatMoney = useFormatMoney();
  const sheet = useRecordSheet();

  const [, startTransition] = React.useTransition();
  const [loaded, setLoaded] = React.useState(rows);
  const [more, setMore] = React.useState(hasMore);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [filtersOpen, setFiltersOpen] = React.useState(false);

  // Ids the user has deleted, so a refresh that still carries them (or a
  // page loaded earlier) does not put them back.
  const deleted = React.useRef(new Set<string>());

  // Two keys, because a refresh means two different things. Changing month or
  // filters is a different list: start again. Everything else — a save, a
  // delete, an edit — is the same list with newer contents, and replacing it
  // wholesale would throw away every page the user had scrolled through.
  const scopeKey = `${year}-${month}-${JSON.stringify(filters)}`;
  const contentKey = rows
    .map((row) =>
      [row.id, row.amount, row.occurredAt, row.categoryId, row.accountId, row.note].join(":"),
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
    [accounts, categories, timeZone, currency.decimals, applyOptimistic, router],
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
                setLoaded((current) => mergeRows([record], current, deleted.current));

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
        toast.error(result.error);
        return;
      }

      setLoaded((current) => mergeRows(current, result.data.rows, deleted.current));
      setMore(result.data.hasMore);
    } catch (thrown) {
      console.error("[records]", thrown);
      toast.error("Could not load more records.");
    } finally {
      setLoadingMore(false);
    }
  }

  const days = React.useMemo(
    () => groupByDay(visible, timeZone),
    [visible, timeZone],
  );

  return (
    <div className="space-y-4">
      <section
        aria-label="This month"
        className="bg-card grid grid-cols-3 divide-x rounded-2xl border"
      >
        <Total label="Income" value={summary.income} tone="income" />
        <Total label="Expense" value={summary.expense} tone="expense" />
        <Total label="Net" value={summary.net} tone="net" />
      </section>

      <UpcomingStrip items={upcoming} today={today} />

      <div className="flex items-center justify-between gap-2">
        <p className="text-muted-foreground px-1 text-xs font-semibold tracking-wider uppercase">
          {visible.length} {visible.length === 1 ? "record" : "records"}
          {more ? "+" : ""}
        </p>

        <Button
          variant="ghost"
          size="sm"
          className="h-9 px-3"
          asChild
        >
          <Link href="/recurring">
            <Repeat className="size-4" aria-hidden="true" />
            Recurring
          </Link>
        </Button>

        <Button
          variant={activeFilterCount > 0 ? "default" : "ghost"}
          size="sm"
          className="h-9 px-3"
          onClick={() => setFiltersOpen(true)}
        >
          <SlidersHorizontal className="size-4" aria-hidden="true" />
          {activeFilterCount > 0 ? `Filters · ${activeFilterCount}` : "Filter"}
        </Button>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title={
            activeFilterCount > 0
              ? "Nothing matches those filters"
              : "No records this month"
          }
          description={
            activeFilterCount > 0
              ? "Try widening the search, or clear the filters to see everything again."
              : "Tap the + button to log your first expense, income or transfer."
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
              <Button size="touch" onClick={sheet.openAdd}>
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
              <div className="mb-1.5 flex items-baseline justify-between px-1">
                <h2 className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                  {day.label}
                </h2>
                <span
                  className={cn(
                    "amount text-xs font-semibold",
                    day.net > 0n ? "text-income" : "text-muted-foreground",
                  )}
                >
                  {day.net === 0n
                    ? ""
                    : formatMoney(day.net, { signDisplay: "always" })}
                </span>
              </div>

              <ul className="bg-card divide-border divide-y overflow-hidden rounded-xl border">
                {day.rows.map((record) => (
                  <li key={record.id}>
                    <RecordRow
                      record={record}
                      pending={record.id.startsWith("optimistic-")}
                      onOpen={() =>
                        sheet.openEdit({
                          id: record.id,
                          type: record.type,
                          amount: record.amount,
                          accountId: record.accountId,
                          toAccountId: record.toAccountId,
                          categoryId: record.categoryId,
                          note: record.note,
                          occurredAtLocal: instantToLocal(
                            record.occurredAt,
                            timeZone,
                          ),
                          recurringRuleId: record.recurringRuleId,
                        })
                      }
                      onDelete={() => remove(record)}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ))}

          {more ? (
            <LoadMore onVisible={loadMore} loading={loadingMore} />
          ) : null}
        </div>
      )}

      <FiltersSheet
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        accounts={accounts}
        categories={categories}
        filters={filters}
      />
    </div>
  );
}

function Total({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "income" | "expense" | "net";
}) {
  const formatMoney = useFormatMoney();
  const amount = BigInt(value);

  return (
    <div className="px-3 py-3 text-center">
      <p className="text-muted-foreground text-[11px] font-medium">{label}</p>
      <p
        className={cn(
          "amount mt-0.5 truncate text-sm font-semibold sm:text-base",
          tone === "income" && "text-income",
          tone === "expense" && "text-expense",
          tone === "net" && amount < 0n && "text-expense",
        )}
      >
        {formatMoney(amount, { signDisplay: "never" })}
      </p>
    </div>
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
          <Skeleton className="h-16 rounded-xl" />
          <Skeleton className="h-16 rounded-xl" />
        </>
      ) : (
        <Skeleton className="h-16 rounded-xl opacity-50" />
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
function groupByDay(rows: TransactionRow[], timeZone: string) {
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
      label: labelFormatter.format(date),
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
