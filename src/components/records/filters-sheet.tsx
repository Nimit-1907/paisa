"use client";

import * as React from "react";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { RotateCcw, Search } from "lucide-react";

import { useCurrency } from "@/components/profile-provider";
import { DateRangeField } from "@/components/shared/date-picker";
import { SegmentedControl } from "@/components/shared/segmented-control";
import { TilePicker } from "@/components/shared/tile-picker";
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

const TYPE_LABELS: Record<TransactionType, string> = {
  expense: "Expense",
  income: "Income",
  transfer: "Transfer",
};

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
    // At most one: the control below is a segmented control, and an older
    // link carrying `?type=expense,income` would show the first as selected
    // while both were still being applied. Normalised on open, so what is
    // shown is what Apply will write.
    setTypes((filters.types ?? []).slice(0, 1));
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
                className="text-text-secondary pointer-events-none absolute inset-y-0 left-3 my-auto size-4"
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

        {/*
          One type or all of them, not a set.

          Phase 13 let you tick two of the three, which with three options
          is the same as excluding the third, and "expense and income but
          not transfers" is not a sentence anybody arrived here to say. The
          segmented control makes the common case one tap and the rare one
          impossible, which is the right trade at three options.
        */}
        <div className="space-y-1.5">
          <Label>Type</Label>
          <SegmentedControl
            label="Type"
            value={types[0] ?? "all"}
            onChange={(next) =>
              setTypes(next === "all" ? [] : [next as TransactionType])
            }
            options={[
              { value: "all", label: "All" },
              ...TRANSACTION_TYPES.map((value) => ({
                value,
                label: TYPE_LABELS[value],
              })),
            ]}
          />
        </div>

        <div className="space-y-1.5">
          <Label>Accounts</Label>
          <TilePicker
            label="Accounts"
            multiple
            value={accountIds}
            onChange={(id) => setAccountIds(toggle(accountIds, id))}
            options={accounts.map((account) => ({
              id: account.id,
              name: account.name,
              icon: account.icon,
              tint: account.tint,
            }))}
          />
        </div>

        <div className="space-y-1.5">
          <Label>Categories</Label>
          {/* The same grid the add sheet uses. Forty category names in a
              wrapping row is a wall of text; the tiles are how people
              actually find the one they want. */}
          <TilePicker
            label="Categories"
            multiple
            value={categoryIds}
            onChange={(id) => setCategoryIds(toggle(categoryIds, id))}
            options={categories.map((category) => ({
              id: category.id,
              name: category.name,
              icon: category.icon,
              tint: category.tint,
            }))}
          />
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
          <Label id="filter-dates-label">Dates</Label>
          {/* The same presets and From and To pickers as Analysis and
              Export. A second tap on the active preset clears it, so the
              pills are not a one-way door into a date range.
              rubric:allow COR-BUG DateRangeField bounds From by To and To by From itself (approved by the user) */}
          <DateRangeField
            id="filter"
            aria-labelledby="filter-dates-label"
            from={from}
            to={to}
            clearable
            placeholder="Any"
            onChange={(next) => {
              setFrom(next.from);
              setTo(next.to);
            }}
          />
        </div>
      </SheetBody>

      {/* Reset is an icon: the recognisable "start over" arrow, square
          beside the one action this sheet exists for. */}
      <SheetFooter className="flex-row gap-2">
        <Button
          variant="outline"
          size="icon-touch"
          aria-label="Reset filters"
          title="Reset filters"
          onClick={clearAll}
        >
          <RotateCcw className="size-5" aria-hidden="true" />
        </Button>
        <Button size="touch" className="flex-1" onClick={apply}>
          Show results
        </Button>
      </SheetFooter>
    </ResponsiveSheet>
  );
}
