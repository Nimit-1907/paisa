"use client";

import * as React from "react";

import { CalendarClock, CalendarDays, MoreHorizontal } from "lucide-react";

import { DynamicIcon } from "@/components/shared/dynamic-icon";
import { FieldCard } from "@/components/shared/field-card";
import { Tile } from "@/components/shared/tile";
import { Label } from "@/components/ui/label";
import { PRESSABLE } from "@/lib/motion";
import { SegmentedControl } from "@/components/shared/segmented-control";
import { TileCell, TilePicker } from "@/components/shared/tile-picker";
import { cn } from "@/lib/utils";

export type AccountOption = {
  id: string;
  name: string;
  icon: string | null;
  /** Kept while the old column exists; nothing reads it since Phase 14. */
  color: string | null;
  /** One of the eight Phase 14 tint keys. */
  tint: string | null;
  /**
   * Minor units as text, or null where the caller has no balance to hand.
   *
   * Only the transfer sheet reads it, to warn when money is being moved out
   * of an account that does not have it. Text rather than a BigInt because
   * this crosses the RSC boundary, which cannot carry one.
   */
  balance?: string | null;
};

export type CategoryOption = AccountOption & { kind: "income" | "expense" };

/**
 * The account and category pickers a transaction and a recurring rule share.
 *
 * Both are templates for the same row, so they ask the same questions; one
 * copy means a fix to the touch targets or the selected state lands in both
 * sheets at once.
 */
export function AccountSelect({
  id,
  label,
  accounts,
  value,
  onChange,
  error,
}: {
  id: string;
  label: string;
  accounts: AccountOption[];
  value: string;
  onChange: (id: string) => void;
  error?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label id={`${id}-label`}>{label}</Label>
      <div
        id={id}
        role="group"
        aria-labelledby={`${id}-label`}
        className="flex flex-wrap gap-1.5"
      >
        {accounts.map((account) => {
          const active = account.id === value;
          return (
            <button
              key={account.id}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(account.id)}
              className={cn(
                PRESSABLE,
                " relative flex h-11 items-center gap-2 rounded-control border px-3 text-sm font-semibold  ",
                active
                  ? "border-ink ring-primary bg-surface-muted ring-1"
                  : "text-text-secondary hoverable:bg-surface-muted",
              )}
            >
              <Tile tint={account.tint} icon={account.icon} size="sm" />
              {account.name}
            </button>
          );
        })}
      </div>
      {error ? (
        <p role="alert" className="text-expense text-sm">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * How many category tiles fit before the grid becomes the whole sheet.
 *
 * Seven and a "More" — two rows of four. A third row of tiles pushes the
 * account, the date and the save button off a 640px phone, and the eighth
 * most-used category is not worth that.
 */
const CATEGORY_LIMIT = 7;

export function CategoryGrid({
  categories,
  value,
  onChange,
  hint,
  error,
}: {
  categories: CategoryOption[];
  value: string;
  onChange: (id: string) => void;
  /** Why these are in this order — "Usually in the afternoon". */
  hint?: string;
  error?: string;
}) {
  const [expanded, setExpanded] = React.useState(false);

  // Folding away one tile to show a "More" that reveals it would be a worse
  // grid than just showing it.
  const folded = !expanded && categories.length > CATEGORY_LIMIT + 1;

  let shown = categories;
  if (folded) {
    shown = categories.slice(0, CATEGORY_LIMIT);

    // A chosen category that fell past the fold takes the last visible
    // place. A grid showing nothing selected, on a form that will not save
    // without a selection, is the harder bug of the two.
    if (value && !shown.some((category) => category.id === value)) {
      const chosen = categories.find((category) => category.id === value);
      if (chosen) shown = [...categories.slice(0, CATEGORY_LIMIT - 1), chosen];
    }
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <Label id="category-grid-label">Category</Label>
        {hint ? (
          <span className="text-text-secondary truncate text-[11px]">
            {hint}
          </span>
        ) : null}
      </div>

      {/*
        The shared TilePicker, so the category grid here, the account grid
        in the filters and the icon grid in the category sheet are one
        component. They are the same question asked four times.
      */}
      <TilePicker
        label="Category"
        value={value || null}
        onChange={onChange}
        options={shown.map((category) => ({
          id: category.id,
          name: category.name,
          icon: category.icon,
          tint: category.tint,
        }))}
        extra={
          folded ? (
            <TileCell
              icon={MoreHorizontal}
              label="More"
              onClick={() => setExpanded(true)}
            />
          ) : null
        }
      />

      {error ? (
        <p role="alert" className="text-expense text-sm">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Expense | Income | Transfer.
 *
 * A thin naming layer over the shared `SegmentedControl` — Phase 14 drops
 * the per-type colours this used to carry. A control that changes colour
 * with its own value competes with the amount below it, which is the thing
 * the colour is actually about.
 */
export function TypeTabs({
  value,
  onChange,
}: {
  value: "expense" | "income" | "transfer";
  onChange: (next: "expense" | "income" | "transfer") => void;
}) {
  return (
    <SegmentedControl
      label="Record type"
      value={value}
      onChange={onChange}
      options={[
        { value: "expense", label: "Expense" },
        { value: "income", label: "Income" },
        { value: "transfer", label: "Transfer" },
      ]}
    />
  );
}

/**
 * The account, as a field card with a native select behind it.
 *
 * The chip row below ({@link AccountSelect}) is still right where choosing
 * the account *is* the step — the recurring-rule sheet asks for little else.
 * On the add sheet it is not: the category grid is the thing being chosen,
 * and a second wrapping row of chips underneath it made two grids compete.
 * One line that says which account, tappable, is what the reference shows.
 */
export function AccountField({
  id,
  label,
  accounts,
  value,
  onChange,
  invalid = false,
  className,
}: {
  id: string;
  label: string;
  accounts: AccountOption[];
  value: string;
  onChange: (id: string) => void;
  invalid?: boolean;
  className?: string;
}) {
  const chosen = accounts.find((account) => account.id === value);

  return (
    <FieldCard
      label={label}
      invalid={invalid}
      className={className}
      icon={
        chosen ? (
          <DynamicIcon
            name={chosen.icon}
            className="text-text-secondary size-3.5 shrink-0"
          />
        ) : null
      }
      value={
        chosen ? (
          chosen.name
        ) : (
          <span className="text-text-secondary font-normal">Choose</span>
        )
      }
      control={
        <select
          id={id}
          aria-label={label}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="">Choose an account</option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
        </select>
      }
    />
  );
}

/**
 * When it happened, as a field card with a native datetime picker behind it.
 *
 * The visible text is {@link describeLocal}'s — "Today, 1:30 pm" — because
 * the browser's own rendering of a `datetime-local` is a different string in
 * every browser and says "today" in none of them. The input itself is what a
 * tap, a keyboard and a screen reader reach.
 */
export function WhenField({
  value,
  onChange,
  display,
  invalid = false,
  className,
}: {
  /** Local `yyyy-mm-ddThh:mm`. */
  value: string;
  onChange: (next: string) => void;
  /** The same instant, in words. */
  display: string;
  invalid?: boolean;
  className?: string;
}) {
  return (
    <FieldCard
      label="When"
      invalid={invalid}
      className={className}
      icon={
        <CalendarClock
          className="text-text-secondary size-3.5 shrink-0"
          aria-hidden="true"
        />
      }
      value={display}
      control={
        <input
          id="occurred-at"
          type="datetime-local"
          aria-label="When"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      }
    />
  );
}

/**
 * A plain date, as a field card over a native date input.
 *
 * The sibling of {@link WhenField} for the places that take a day rather
 * than a moment: a rule's next run, an end date, the start of a range. Same
 * reasoning — the card shows "3 Dec 2026", the control underneath is the
 * browser's own.
 */
export function DateField({
  id,
  label,
  value,
  onChange,
  min,
  max,
  placeholder = "Not set",
  invalid = false,
  className,
}: {
  id: string;
  label: string;
  /** `yyyy-mm-dd`, or "" when there is none. */
  value: string;
  onChange: (next: string) => void;
  min?: string;
  max?: string;
  /** What to show when the date is unset — "No end date". */
  placeholder?: string;
  invalid?: boolean;
  className?: string;
}) {
  return (
    <FieldCard
      label={label}
      invalid={invalid}
      className={className}
      icon={
        <CalendarDays
          className="text-text-secondary size-3.5 shrink-0"
          aria-hidden="true"
        />
      }
      value={
        value ? (
          formatDay(value)
        ) : (
          <span className="text-text-secondary font-normal">{placeholder}</span>
        )
      }
      control={
        <input
          id={id}
          type="date"
          aria-label={label}
          value={value}
          min={min}
          max={max}
          onChange={(event) => onChange(event.target.value)}
        />
      }
    />
  );
}

/** "3 Dec 2026" — the same shape the rest of the app writes a date in. */
function formatDay(day: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${day}T00:00:00Z`));
}
