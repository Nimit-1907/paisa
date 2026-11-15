"use client";

import * as React from "react";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Search } from "lucide-react";

import { useCurrency } from "@/components/profile-provider";
import { ColorDot } from "@/components/shared/color-dot";
import type {
  AccountOption,
  CategoryOption,
} from "@/components/records/record-sheet";
import {
  ResponsiveSheet,
  SheetBody,
  SheetFooter,
} from "@/components/shared/responsive-sheet";
import { Button } from "@/components/ui/button";
import { FormRow } from "@/components/ui/form-row";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useClearFilters } from "@/components/records/use-clear-filters";
import {
  TRANSACTION_TYPES,
  type TransactionFilters,
  type TransactionType,
} from "@/lib/schemas/transactions";
import { cn } from "@/lib/utils";

const TYPE_LABELS: Record<TransactionType, string> = {
  expense: "Expense",
  income: "Income",
  transfer: "Transfer",
};

/** `yyyy-mm-dd` for a UTC date, which is what the date inputs want. */
const day = (date: Date) => date.toISOString().slice(0, 10);

/**
 * The date ranges people actually ask for.
 *
 * Built from today each time they are rendered rather than once at module
 * load: a tab left open overnight would otherwise offer yesterday's
 * "last 7 days".
 *
 * Computed in UTC, matching the `date` inputs beside them and the
 * `yyyy-mm-dd` the server parses. The server turns these into the user's own
 * local midnight, which is the only place a timezone belongs.
 */
const DATE_PRESETS = [
  {
    label: "Last 7 days",
    range: () => {
      const today = new Date();
      const start = new Date(today);
      start.setUTCDate(start.getUTCDate() - 6);
      return { from: day(start), to: day(today) };
    },
  },
  {
    label: "Last 30 days",
    range: () => {
      const today = new Date();
      const start = new Date(today);
      start.setUTCDate(start.getUTCDate() - 29);
      return { from: day(start), to: day(today) };
    },
  },
  {
    label: "First half",
    range: () => {
      const today = new Date();
      const year = today.getUTCFullYear();
      const month = today.getUTCMonth();
      return {
        from: day(new Date(Date.UTC(year, month, 1))),
        to: day(new Date(Date.UTC(year, month, 15))),
      };
    },
  },
  {
    label: "Second half",
    range: () => {
      const today = new Date();
      const year = today.getUTCFullYear();
      const month = today.getUTCMonth();
      return {
        from: day(new Date(Date.UTC(year, month, 16))),
        // Day 0 of the next month is the last day of this one.
        to: day(new Date(Date.UTC(year, month + 1, 0))),
      };
    },
  },
] as const;

/**
 * Search and filters.
 *
 * Everything lives in the URL, so a filtered view can be shared, reloaded and
 * navigated back out of. The server reads the same parameters, which keeps
 * the list and the chips from ever disagreeing.
 */
export function FiltersSheet({
  open,
  onOpenChange,
  accounts,
  categories,
  filters,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: AccountOption[];
  categories: CategoryOption[];
  filters: TransactionFilters;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const currency = useCurrency();
  const clearFilters = useClearFilters();

  const [search, setSearch] = React.useState("");
  const [types, setTypes] = React.useState<TransactionType[]>([]);
  const [accountIds, setAccountIds] = React.useState<string[]>([]);
  const [categoryIds, setCategoryIds] = React.useState<string[]>([]);
  const [minAmount, setMinAmount] = React.useState("");
  const [maxAmount, setMaxAmount] = React.useState("");
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");

  React.useEffect(() => {
    if (!open) return;

    setSearch(filters.search ?? "");
    setTypes(filters.types ?? []);
    setAccountIds(filters.accountIds ?? []);
    setCategoryIds(filters.categoryIds ?? []);
    setMinAmount(filters.minAmount ?? "");
    setMaxAmount(filters.maxAmount ?? "");
    setFrom(filters.from ?? "");
    setTo(filters.to ?? "");
  }, [open, filters]);

  function toggle<T>(list: T[], value: T): T[] {
    return list.includes(value)
      ? list.filter((item) => item !== value)
      : [...list, value];
  }

  function apply() {
    const next = new URLSearchParams(params.toString());

    const set = (key: string, value: string | string[] | undefined) => {
      const text = Array.isArray(value) ? value.join(",") : value;
      if (text) next.set(key, text);
      else next.delete(key);
    };

    set("q", search.trim());
    set("type", types);
    set("account", accountIds);
    set("category", categoryIds);
    set("min", minAmount.trim());
    set("max", maxAmount.trim());
    set("from", from);
    set("to", to);

    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    onOpenChange(false);
  }

  function clearAll() {
    clearFilters();
    onOpenChange(false);
  }

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Search and filter"
      description="Narrows the records for this month."
    >
      <SheetBody>
        <FormRow id="filter-search" label="Note contains">
          {(props) => (
            <div className="relative">
              <Search
                className="text-ink-2 pointer-events-none absolute inset-y-0 left-3 my-auto size-4"
                aria-hidden="true"
              />
              <Input
                {...props}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="swiggy, petrol, rent…"
                className="pl-9"
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    apply();
                  }
                }}
              />
            </div>
          )}
        </FormRow>

        <div className="space-y-1.5">
          <Label>Type</Label>
          <div className="flex flex-wrap gap-1.5">
            {TRANSACTION_TYPES.map((value) => (
              <Chip
                key={value}
                active={types.includes(value)}
                onClick={() => setTypes(toggle(types, value))}
              >
                {TYPE_LABELS[value]}
              </Chip>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Accounts</Label>
          <div className="flex flex-wrap gap-1.5">
            {accounts.map((account) => (
              <Chip
                key={account.id}
                active={accountIds.includes(account.id)}
                onClick={() => setAccountIds(toggle(accountIds, account.id))}
              >
                {account.name}
              </Chip>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Categories</Label>
          <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto overscroll-contain">
            {categories.map((category) => (
              <Chip
                key={category.id}
                active={categoryIds.includes(category.id)}
                onClick={() => setCategoryIds(toggle(categoryIds, category.id))}
              >
                {/* The same dot the rows use. A list of forty category names
                    is a wall of text; the colour is how people actually find
                    the one they want. */}
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
        </div>

        <div className="grid grid-cols-2 gap-2">
          <FormRow id="filter-min" label={`Min (${currency.symbol})`}>
            {(props) => (
              <Input
                {...props}
                value={minAmount}
                onChange={(event) => setMinAmount(event.target.value)}
                inputMode="decimal"
                placeholder="0"
                className="amount"
              />
            )}
          </FormRow>

          <FormRow id="filter-max" label={`Max (${currency.symbol})`}>
            {(props) => (
              <Input
                {...props}
                value={maxAmount}
                onChange={(event) => setMaxAmount(event.target.value)}
                inputMode="decimal"
                placeholder="Any"
                className="amount"
              />
            )}
          </FormRow>
        </div>

        <div className="space-y-1.5">
          <Label>Dates</Label>
          <div className="flex flex-wrap gap-1.5">
            {DATE_PRESETS.map((preset) => {
              const range = preset.range();
              return (
                <Chip
                  key={preset.label}
                  active={from === range.from && to === range.to}
                  onClick={() => {
                    // A second tap on the active preset clears it, so the
                    // chips are not a one-way door into a date range.
                    const on = from === range.from && to === range.to;
                    setFrom(on ? "" : range.from);
                    setTo(on ? "" : range.to);
                  }}
                >
                  {preset.label}
                </Chip>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <FormRow id="filter-from" label="From">
            {(props) => (
              <Input
                {...props}
                type="date"
                value={from}
                onChange={(event) => setFrom(event.target.value)}
              />
            )}
          </FormRow>

          <FormRow id="filter-to" label="To">
            {(props) => (
              <Input
                {...props}
                type="date"
                value={to}
                onChange={(event) => setTo(event.target.value)}
              />
            )}
          </FormRow>
        </div>
      </SheetBody>

      <SheetFooter>
        <Button
          variant="outline"
          size="touch"
          className="flex-1"
          onClick={clearAll}
        >
          Clear all
        </Button>
        <Button size="touch" className="flex-1" onClick={apply}>
          Show results
        </Button>
      </SheetFooter>
    </ResponsiveSheet>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "focus-visible:ring-ring flex h-11 items-center gap-1.5 rounded-full border px-3 text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:outline-none",
        active
          ? "border-primary bg-primary/10 text-primary"
          : "text-ink-2 hoverable:bg-muted",
      )}
    >
      {children}
    </button>
  );
}
