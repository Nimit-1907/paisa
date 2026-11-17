"use client";

import * as React from "react";

import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  Clock,
  Loader2,
  Search,
  X,
} from "lucide-react";

import { searchRecords } from "@/actions/transactions";
import { useRecordSheet } from "@/components/records/record-sheet-provider";
import { Amount } from "@/components/shared/amount";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { HeroStat, HeroSplit } from "@/components/shared/hero-stat";
import { ListRow } from "@/components/shared/list-row";
import { SectionHeader } from "@/components/shared/section-header";
import { ListCard } from "@/components/shared/surface";
import { Tile } from "@/components/shared/tile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { TransactionRow } from "@/lib/queries/transactions";
import { draftOf } from "@/lib/record-draft";
import { groupByMonth } from "@/lib/search-groups";
import {
  forgetSearches,
  recentSearches,
  rememberSearch,
} from "@/lib/recent-searches";
import { cn } from "@/lib/utils";

type Results = {
  term: string;
  rows: TransactionRow[];
  /** Every match, which can be more than the rows shown. */
  matchCount: number;
  hasMore: boolean;
  income: bigint;
  expense: bigint;
};

/**
 * Search, taking the whole screen.
 *
 * Searching is a mode, not a field: you stop reading the month and start
 * looking for one thing. A box tucked into a filters sheet makes that a
 * three-tap detour, and the keyboard covers the results anyway, so this
 * takes the screen, opens the keyboard immediately, and puts the two things
 * worth offering under it.
 *
 * Those two are **what you looked for before**, which on a phone is most
 * searches, and **a few filters worth one tap**. Neither is clever: the
 * suggestions are this month, the categories you actually use, and a round
 * number, because those are the three ways people narrow a list of spending.
 *
 * Phase 14 answers here rather than handing the term back to the month.
 * Searching inside one month is a question with an obvious answer; the one
 * worth asking, when did the rent go up, how much have I spent on this all
 * year, needs every month at once, which is what `searchRecords` returns.
 * The results are grouped by month with the total above them, and tapping
 * one opens it in the sheet, where Edit and Delete already live.
 *
 * Matches appear as you type, once two letters have sat still for
 * `LIVE_DELAY` ms: a box that shows nothing until Enter read as broken.
 * Only a deliberate search, Enter or a tapped result, is remembered in
 * Recent, so "sw" and "swi" never land there.
 */
/** How long typing has to pause before the box searches by itself. */
const LIVE_DELAY = 300;

export function SearchOverlay({
  open,
  initialQuery,
  timeZone,
  onClose,
}: {
  open: boolean;
  /** Whatever is already being searched for, so this reopens where it was. */
  initialQuery: string;
  timeZone: string;
  onClose: () => void;
}) {
  const sheet = useRecordSheet();
  const [query, setQuery] = React.useState(initialQuery);
  const [recent, setRecent] = React.useState<string[]>([]);
  const [results, setResults] = React.useState<Results | null>(null);
  const [searching, setSearching] = React.useState(false);
  const [error, setError] = React.useState<{
    term: string;
    message: string;
  } | null>(null);
  const input = React.useRef<HTMLInputElement>(null);

  /*
   * Which search is the current one.
   *
   * Typing "rent", then "swiggy" before the first answer lands, can resolve
   * in either order, and the slower one finishing last would leave rent's
   * results under swiggy's term. Every call takes a ticket; a stale one
   * drops its answer on the floor. Closing the overlay or clearing the
   * field takes a ticket too, so a request in flight cannot repopulate
   * something the user has just emptied.
   */
  const ticket = React.useRef(0);

  /** The term whose answer is on screen or on its way. */
  const searched = React.useRef("");

  React.useEffect(() => {
    if (!open) return;

    ticket.current += 1;
    searched.current = "";
    setQuery(initialQuery);
    setResults(null);
    setError(null);
    setSearching(false);
    // Read on open rather than on mount: `localStorage` does not exist while
    // this renders on the server, and the list changes while the screen is
    // alive.
    setRecent(recentSearches());

    // After the panel has painted, or the keyboard opens against an element
    // that is not on screen yet.
    const id = window.setTimeout(() => input.current?.focus(), 50);
    return () => window.clearTimeout(id);
  }, [open, initialQuery]);

  /*
   * Escape closes it, like every other dialog in the app.
   *
   * Radix handles this for the sheets; this one is hand-rolled because it
   * takes the whole screen rather than part of it, and it had never had the
   * key bound, which on a desktop is a modal with no way out but the mouse.
   */
  const close = React.useRef(onClose);
  close.current = onClose;

  React.useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape" || event.defaultPrevented) return;

      // A record sheet or a confirm dialog can be stacked on top of this,
      // tapping a result opens one. Escape belongs to whatever is topmost,
      // and closing the screen underneath it instead is how a user ends up
      // somewhere they did not navigate to.
      if (
        document.querySelector(
          '[data-slot="drawer-content"], [data-slot="dialog-content"]',
        )
      ) {
        return;
      }

      event.preventDefault();
      close.current();
    }

    // On the document rather than on the panel: focus can be on the body
    // after a pointer-down on the backdrop, and a handler bound to the
    // panel would never see the key.
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const submit = React.useCallback(
    async (term: string, { live = false }: { live?: boolean } = {}) => {
      const trimmed = term.trim();
      if (!trimmed) return;

      const mine = (ticket.current += 1);
      searched.current = trimmed;

      // A live search leaves the field alone, a trailing space mid-word
      // included, and stays out of Recent.
      if (!live) {
        setQuery(trimmed);
        setRecent(rememberSearch(trimmed));
      }
      setSearching(true);
      setError(null);

      try {
        const result = await searchRecords({ term: trimmed });
        if (ticket.current !== mine) return;

        if (!result.ok) {
          setError({ term: trimmed, message: result.error });
          setResults(null);
          return;
        }

        setResults({
          term: trimmed,
          rows: result.data.rows,
          matchCount: result.data.matchCount,
          hasMore: result.data.hasMore,
          income: BigInt(result.data.income),
          expense: BigInt(result.data.expense),
        });
      } catch (thrown) {
        if (ticket.current !== mine) return;
        console.error("[records]", thrown);
        setError({
          term: trimmed,
          message: "Could not search your records. Check your connection.",
        });
        setResults(null);
      } finally {
        if (ticket.current === mine) setSearching(false);
      }
    },
    [],
  );

  // Search as you type, after a pause. Skipped when the term is the one
  // already on screen, which is the case straight after Enter.
  React.useEffect(() => {
    if (!open) return;
    const trimmed = query.trim();
    if (trimmed.length < 2 || trimmed === searched.current) return;

    const id = window.setTimeout(
      () => void submit(trimmed, { live: true }),
      LIVE_DELAY,
    );
    return () => window.clearTimeout(id);
  }, [open, query, submit]);

  if (!open) return null;

  /** Back to the suggestions, without closing the whole screen. */
  function clear() {
    ticket.current += 1;
    searched.current = "";
    setQuery("");
    setResults(null);
    setError(null);
    setSearching(false);
    input.current?.focus();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Search records"
      className="bg-background fixed inset-0 z-50 flex flex-col lg:items-center lg:justify-start lg:bg-black/40 lg:pt-20"
    >
      <div className="bg-surface lg:rounded-card flex min-h-0 w-full flex-1 flex-col lg:max-h-[80dvh] lg:max-w-xl lg:flex-none lg:border">
        <div className="flex items-center gap-2 border-b px-2 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2">
          <Button
            variant="ghost"
            size="icon-touch"
            aria-label="Close search"
            onClick={onClose}
          >
            <ArrowLeft className="size-5" aria-hidden="true" />
          </Button>

          {/*
            One field, the same at rest and in focus: a muted box with the
            search icon at the left and Clear inside it at the right. It
            used to be borderless until focused and then gain a thick box,
            and Clear arrived beside it, so the field changed width the
            moment you started typing.
          */}
          <div className="relative min-w-0 flex-1">
            <Search
              className="text-text-secondary pointer-events-none absolute inset-y-0 left-3 my-auto size-4"
              aria-hidden="true"
            />
            <Input
              ref={input}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                // An empty box has no answer. Without this the results for
                // the last term sit under a field that says nothing, and
                // Enter on an empty field is refused and changes nothing.
                if (!event.target.value.trim()) clear();
              }}
              // `search` so the on-screen keyboard's return key says Search.
              type="search"
              enterKeyHint="search"
              aria-label="Search notes"
              placeholder="Search notes"
              // Chrome draws its own clear "×" inside a search input; ours
              // is the 44px one, and two side by side is a question about
              // which one does what.
              className="bg-surface-muted h-11 w-full border-transparent pr-11 pl-9 [&::-webkit-search-cancel-button]:appearance-none"
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void submit(query);
                }
              }}
            />

            {query ? (
              <button
                type="button"
                aria-label="Clear"
                onClick={clear}
                className="text-text-secondary hoverable:text-text rounded-control absolute inset-y-0 right-0 flex size-11 items-center justify-center"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            ) : null}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
          {searching ? (
            <p
              role="status"
              className="text-text-secondary flex items-center justify-center gap-2 py-12 text-sm"
            >
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Searching every month…
            </p>
          ) : error ? (
            <ErrorState
              title="That search did not go through"
              description={error.message}
              // The term that failed, not whatever is in the box now: a
              // retry that searches something else is not a retry.
              onRetry={() => void submit(error.term)}
            />
          ) : results ? (
            <>
              {/*
                Nothing is searched as you type, so typing over a finished
                search leaves its results sitting there, a list headed
                “Zomato” under a box that now says "coff", and, worse, a
                "Nothing matches that" about a word the box no longer
                holds. Saying which term the list belongs to is most of the
                fix; the rest is offering the search rather than explaining
                which key performs it, since that key is labelled Enter on
                a desktop and Search on a phone.
              */}
              {query.trim() && query.trim() !== results.term ? (
                <p
                  role="status"
                  className="text-text-secondary mb-3 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm"
                >
                  <span className="min-w-0 truncate">
                    Still showing “{results.term}”.
                  </span>
                  <button
                    type="button"
                    onClick={() => void submit(query)}
                    className="text-text min-w-0 max-w-full truncate rounded font-semibold underline underline-offset-2"
                  >
                    Search “{query.trim()}”
                  </button>
                </p>
              ) : null}

              <SearchResults
                results={results}
                timeZone={timeZone}
                onClear={clear}
                onOpen={(record) => {
                  // The sheet is the one place a record can be read,
                  // changed and deleted; sending a search result anywhere
                  // else would mean a second copy of all three.
                  // Opening a match is the search having worked, so it is
                  // remembered even when Enter was never pressed.
                  setRecent(rememberSearch(results.term));
                  onClose();
                  sheet.openEdit(draftOf(record, timeZone));
                }}
              />
            </>
          ) : (
            <>
              {recent.length > 0 ? (
                <section className="mb-6">
                  <SectionHeader
                    title="Recent"
                    className="mb-2"
                    trailing={
                      <button
                        type="button"
                        onClick={() => {
                          forgetSearches();
                          setRecent([]);
                        }}
                        className="text-text-secondary hoverable:text-text rounded-control -my-2 px-1 py-2 text-xs font-semibold"
                      >
                        Clear
                      </button>
                    }
                  />

                  {/* Pills, not rows. A past search is a word, and eight
                      words wrap into three lines where eight rows are a
                      screenful. */}
                  <div className="flex flex-wrap gap-1.5">
                    {recent.map((term) => (
                      <Chip key={term} onClick={() => void submit(term)}>
                        <Clock
                          className="text-text-secondary size-3.5 shrink-0"
                          aria-hidden="true"
                        />
                        {term}
                      </Chip>
                    ))}
                  </div>
                </section>
              ) : null}

              {/* Filtering lives on the Filter button; this screen only
                  searches, across every month. */}
              <p className="text-text-secondary px-1 text-sm">
                Searches the notes of every record, in every month.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** The answer: a total, then the months it came from. */
function SearchResults({
  results,
  timeZone,
  onOpen,
  onClear,
}: {
  results: Results;
  timeZone: string;
  onOpen: (record: TransactionRow) => void;
  onClear: () => void;
}) {
  const months = React.useMemo(
    () => groupByMonth(results.rows, timeZone),
    [results.rows, timeZone],
  );

  if (results.rows.length === 0) {
    return (
      <EmptyState
        icon={Search}
        title="Nothing matches that"
        description={`No record's note contains “${results.term}”. Try a shorter word, or part of one.`}
        action={
          <Button variant="outline" size="touch" onClick={onClear}>
            Clear search
          </Button>
        }
      />
    );
  }

  const both = results.income > 0n && results.expense > 0n;

  return (
    <div className="space-y-4">
      <HeroStat
        label={`“${results.term}”`}
        value={
          <span className={results.expense > 0n ? undefined : "text-income"}>
            <Amount
              value={results.expense > 0n ? results.expense : results.income}
              whole
            />
          </span>
        }
        // The figure is over every match; the list below is the newest
        // hundred of them. Saying both is the only honest version.
        helper={`${results.matchCount} ${
          results.matchCount === 1 ? "record" : "records"
        }${
          results.hasMore ? `, newest ${results.rows.length} shown` : ""
        } · ${months.length === 1 ? months[0]!.label : `${months.length} months`}`}
        split={
          both ? (
            <>
              <HeroSplit
                label="Income"
                tint="bg-tint-mint"
                icon={<ArrowDownLeft className="size-3.5" />}
                value={
                  <span className="text-income">
                    <Amount value={results.income} signDisplay="always" whole />
                  </span>
                }
              />
              <HeroSplit
                label="Spent"
                tint="bg-tint-rose"
                icon={<ArrowUpRight className="size-3.5" />}
                value={
                  <span className="text-expense">
                    <Amount
                      value={-results.expense}
                      signDisplay="always"
                      whole
                    />
                  </span>
                }
              />
            </>
          ) : undefined
        }
      />

      {months.map((group) => (
        <section key={group.key} aria-label={group.label}>
          <SectionHeader
            title={group.label}
            className="mb-1.5 px-1"
            trailing={
              <span className="text-text-secondary text-xs font-semibold">
                <Amount value={group.net} signDisplay="always" />
              </span>
            }
          />

          <ListCard>
            {group.rows.map((record) => (
              <li key={record.id}>
                <ListRow
                  onClick={() => onOpen(record)}
                  leading={
                    <Tile
                      size="md"
                      tint={
                        record.type === "transfer" ? "sky" : record.categoryTint
                      }
                      icon={
                        record.type === "transfer"
                          ? "ArrowLeftRight"
                          : record.categoryIcon
                      }
                    />
                  }
                  title={
                    record.note ??
                    (record.type === "transfer"
                      ? "Transfer"
                      : (record.categoryName ?? "Uncategorised"))
                  }
                  subtitle={`${dayLabel(record.occurredAt, timeZone)} · ${
                    record.type === "transfer"
                      ? `${record.accountName} → ${record.toAccountName ?? ""}`
                      : record.accountName
                  }`}
                  trailing={
                    <span
                      className={cn(
                        "text-sm font-semibold",
                        record.type === "income"
                          ? "text-income"
                          : record.type === "transfer"
                            ? "text-transfer"
                            : // Red, as on the list: the same record
                              // in two colours read as two kinds.
                              "text-expense",
                      )}
                    >
                      {record.type === "income"
                        ? "+"
                        : record.type === "expense"
                          ? "−"
                          : ""}
                      <Amount
                        value={BigInt(record.amount)}
                        signDisplay="never"
                      />
                    </span>
                  }
                />
              </li>
            ))}
          </ListCard>
        </section>
      ))}
    </div>
  );
}

/** "9 Nov", enough to place a row inside its month. */
function dayLabel(instant: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone,
    day: "numeric",
    month: "short",
  }).format(new Date(instant));
}

function Chip({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="bg-surface-muted text-text hoverable:bg-hairline pressable flex h-11 items-center gap-1.5 rounded-full px-3 text-sm font-semibold"
    >
      {children}
    </button>
  );
}
