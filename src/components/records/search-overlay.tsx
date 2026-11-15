"use client";

import * as React from "react";

import { ArrowLeft, Clock, Search, X } from "lucide-react";

import { useCurrency } from "@/components/profile-provider";
import { ColorDot } from "@/components/shared/color-dot";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatWith } from "@/lib/money";
import {
  forgetSearches,
  recentSearches,
  rememberSearch,
} from "@/lib/recent-searches";
import type { CategoryOption } from "@/components/records/record-sheet";
import { cn } from "@/lib/utils";

/**
 * Search, taking the whole screen.
 *
 * Searching is a mode, not a field: you stop reading the month and start
 * looking for one thing. A box tucked into a filters sheet makes that a
 * three-tap detour, and the keyboard covers the results anyway — so this
 * takes the screen, opens the keyboard immediately, and puts the two things
 * worth offering under it.
 *
 * Those two are **what you looked for before**, which on a phone is most
 * searches, and **a few filters worth one tap**. Neither is clever: the
 * suggestions are this month, the categories you actually use, and a round
 * number, because those are the three ways people narrow a list of spending.
 *
 * Nothing is searched as you type. A query per keystroke over a month of
 * records is a lot of work to show a list nobody is reading yet, and the
 * keyboard's own search key is the gesture people already use.
 */
export function SearchOverlay({
  open,
  initialQuery,
  categories,
  monthKey,
  onClose,
  onSearch,
  onFilter,
}: {
  open: boolean;
  /** Whatever is already being searched for, so this reopens where it was. */
  initialQuery: string;
  /** The ones used this month, most-used first, for the suggestion chips. */
  categories: CategoryOption[];
  monthKey: string;
  onClose: () => void;
  onSearch: (query: string) => void;
  /** A one-tap filter: a category, a date range, an amount floor. */
  onFilter: (params: Record<string, string>) => void;
}) {
  const currency = useCurrency();
  const [query, setQuery] = React.useState(initialQuery);
  const [recent, setRecent] = React.useState<string[]>([]);
  const input = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!open) return;

    setQuery(initialQuery);
    // Read on open rather than on mount: `localStorage` does not exist while
    // this renders on the server, and the list changes while the screen is
    // alive.
    setRecent(recentSearches());

    // After the panel has painted, or the keyboard opens against an element
    // that is not on screen yet.
    const id = window.setTimeout(() => input.current?.focus(), 50);
    return () => window.clearTimeout(id);
  }, [open, initialQuery]);

  if (!open) return null;

  function submit(term: string) {
    const trimmed = term.trim();
    if (trimmed) setRecent(rememberSearch(trimmed));
    onSearch(trimmed);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Search records"
      className="bg-background fixed inset-0 z-50 flex flex-col lg:items-center lg:justify-start lg:bg-black/40 lg:pt-20"
    >
      <div className="raised flex min-h-0 w-full flex-1 flex-col lg:max-w-xl lg:flex-none lg:rounded-card lg:border">
        <div className="pt-safe flex items-center gap-2 border-b px-2 py-2">
          <Button
            variant="ghost"
            size="icon-touch"
            className="rounded-full"
            aria-label="Close search"
            onClick={onClose}
          >
            <ArrowLeft className="size-5" aria-hidden="true" />
          </Button>

          <div className="relative flex-1">
            <Search
              className="text-ink-3 pointer-events-none absolute inset-y-0 left-3 my-auto size-4"
              aria-hidden="true"
            />
            <Input
              ref={input}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              // `search` so the on-screen keyboard's return key says Search.
              type="search"
              enterKeyHint="search"
              aria-label="Search notes"
              placeholder="swiggy, petrol, rent…"
              className="border-0 bg-transparent pl-9 shadow-none focus-visible:ring-0"
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  submit(query);
                }
              }}
            />
          </div>

          {query ? (
            <Button
              variant="ghost"
              size="icon-touch"
              className="rounded-full"
              aria-label="Clear"
              onClick={() => {
                setQuery("");
                input.current?.focus();
              }}
            >
              <X className="size-5" aria-hidden="true" />
            </Button>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
          {recent.length > 0 ? (
            <section className="mb-6">
              <div className="mb-2 flex items-center justify-between gap-3">
                <h2 className="text-ink-2 text-label font-semibold tracking-wide uppercase">
                  Recent
                </h2>
                <button
                  type="button"
                  onClick={() => {
                    forgetSearches();
                    setRecent([]);
                  }}
                  className="text-ink-2 hoverable:text-ink focus-visible:ring-ring -my-2 rounded px-1 py-2 text-xs font-semibold focus-visible:ring-2 focus-visible:outline-none"
                >
                  Clear
                </button>
              </div>

              <ul className="space-y-0.5">
                {recent.map((term) => (
                  <li key={term}>
                    <button
                      type="button"
                      onClick={() => submit(term)}
                      className="hoverable:bg-muted focus-visible:ring-ring rounded-control flex min-h-11 w-full items-center gap-2.5 px-2 text-left text-sm focus-visible:ring-2 focus-visible:outline-none"
                    >
                      <Clock
                        className="text-ink-3 size-4 shrink-0"
                        aria-hidden="true"
                      />
                      <span className="truncate">{term}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section>
            <h2 className="text-ink-2 text-label mb-2 font-semibold tracking-wide uppercase">
              Or narrow it down
            </h2>

            <div className="flex flex-wrap gap-1.5">
              <Chip onClick={() => onFilter({ m: monthKey })}>This month</Chip>
              {/* In the user's own currency, with the paise trimmed: a bare
                  "1,000" on a money screen is a number without a unit. */}
              <Chip onClick={() => onFilter({ min: "1000" })}>
                Over{" "}
                {formatWith(currency, 1000n * 10n ** BigInt(currency.decimals), {
                  paise: "trim",
                })}
              </Chip>
              <Chip onClick={() => onFilter({ type: "income" })}>
                Income only
              </Chip>

              {categories.slice(0, 6).map((category) => (
                <Chip
                  key={category.id}
                  onClick={() => onFilter({ category: category.id })}
                >
                  <ColorDot
                    size="sm"
                    color={category.color}
                    icon={category.icon}
                    className="-ml-1.5"
                  />
                  {category.name}
                </Chip>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
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
      className={cn(
        "border-input text-ink hoverable:bg-muted focus-visible:ring-ring",
        "flex h-11 items-center gap-1.5 rounded-full border px-3 text-sm font-semibold",
        "focus-visible:ring-2 focus-visible:outline-none",
      )}
    >
      {children}
    </button>
  );
}
