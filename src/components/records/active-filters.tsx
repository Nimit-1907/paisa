"use client";

import { X } from "lucide-react";

import { useCurrency } from "@/components/profile-provider";
import type {
  AccountOption,
  CategoryOption,
} from "@/components/records/record-sheet";
import { formatWith, tryToMinor } from "@/lib/money";
import type { TransactionFilters } from "@/lib/schemas/transactions";

const TYPE_LABELS = {
  expense: "Expense",
  income: "Income",
  transfer: "Transfer",
} as const;

/**
 * What is currently narrowing the list, as chips you can take off.
 *
 * A filter you cannot see is a filter you forget, and "where did my records
 * go?" is the support question that follows. The count on the Filter button
 * says *how many*; this says *which*, and lets each one go in a tap rather
 * than through the sheet.
 *
 * Every chip reads as a sentence fragment — "Food", "over ₹1,000",
 * "from 1 Nov" — because a bare value with no preposition is a guessing game
 * about which field it belongs to.
 */
export function ActiveFilters({
  filters,
  accounts,
  categories,
  onRemove,
  onClearAll,
}: {
  filters: TransactionFilters;
  accounts: AccountOption[];
  categories: CategoryOption[];
  /** Drops one filter, by the query parameter it lives in. */
  onRemove: (key: string, value?: string) => void;
  onClearAll: () => void;
}) {
  const currency = useCurrency();

  const chips: { key: string; value?: string; label: string }[] = [];

  if (filters.search) {
    chips.push({ key: "q", label: `“${filters.search}”` });
  }

  for (const type of filters.types ?? []) {
    chips.push({ key: "type", value: type, label: TYPE_LABELS[type] });
  }

  for (const id of filters.accountIds ?? []) {
    const account = accounts.find((item) => item.id === id);
    // An id with no account behind it is a hand-edited URL or an account
    // deleted in another tab. Named rather than dropped, so the chip can
    // still be taken off.
    chips.push({
      key: "account",
      value: id,
      label: account?.name ?? "Account",
    });
  }

  for (const id of filters.categoryIds ?? []) {
    const category = categories.find((item) => item.id === id);
    chips.push({
      key: "category",
      value: id,
      label: category?.name ?? "Category",
    });
  }

  const money = (text: string) => {
    const minor = tryToMinor(text, currency.decimals);
    return minor === null
      ? text
      : formatWith(currency, minor, { paise: "trim" });
  };

  if (filters.minAmount) {
    chips.push({ key: "min", label: `over ${money(filters.minAmount)}` });
  }
  if (filters.maxAmount) {
    chips.push({ key: "max", label: `under ${money(filters.maxAmount)}` });
  }
  if (filters.from) {
    chips.push({ key: "from", label: `from ${shortDay(filters.from)}` });
  }
  if (filters.to) {
    chips.push({ key: "to", label: `to ${shortDay(filters.to)}` });
  }

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {chips.map((chip) => (
        <button
          key={`${chip.key}:${chip.value ?? ""}`}
          type="button"
          onClick={() => onRemove(chip.key, chip.value)}
          aria-label={`Remove filter: ${chip.label}`}
          className="bg-accent text-text hoverable:bg-accent/80 pressable flex h-11 items-center gap-1.5 rounded-full pr-2.5 pl-3.5 text-xs font-semibold"
        >
          <span className="max-w-[16ch] truncate">{chip.label}</span>
          <X className="size-3.5 shrink-0" aria-hidden="true" />
        </button>
      ))}

      {chips.length > 1 ? (
        <button
          type="button"
          onClick={onClearAll}
          className="text-text-secondary hoverable:text-text rounded-full h-11 px-3 text-xs font-semibold"
        >
          Clear all
        </button>
      ) : null}
    </div>
  );
}

/** "1 Nov" from a `yyyy-mm-dd`, without pulling in a date library. */
function shortDay(day: string): string {
  const [year, month, date] = day.split("-").map(Number);
  if (!year || !month || !date) return day;

  // UTC throughout: this is a calendar date with no time in it, and
  // constructing it locally can land on the day before.
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
  }).format(new Date(Date.UTC(year, month - 1, date)));
}
