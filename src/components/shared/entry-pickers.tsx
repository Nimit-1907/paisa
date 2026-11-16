"use client";

import * as React from "react";

import { MoreHorizontal } from "lucide-react";

import { DynamicIcon } from "@/components/shared/dynamic-icon";
import { FieldCard } from "@/components/shared/field-card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
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
  /** One of the sixteen tint keys in `lib/tokens.ts`. */
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
 * Seven and a "More", two rows of four. A third row of tiles pushes the
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
  fold = true,
  showLabel = true,
}: {
  categories: CategoryOption[];
  value: string;
  onChange: (id: string) => void;
  /** Why these are in this order, "Usually in the afternoon". */
  hint?: string;
  error?: string;
  /** Fold past seven behind "More". Off in a picker sheet, which has room. */
  fold?: boolean;
  /** Off in a picker sheet, whose title already says "Choose a category". */
  showLabel?: boolean;
}) {
  const [expanded, setExpanded] = React.useState(!fold);

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
      <div
        className={cn(
          "flex items-baseline justify-between gap-2",
          !showLabel && !hint && "hidden",
        )}
      >
        {showLabel ? (
          <Label id="category-grid-label">Category</Label>
        ) : (
          <span />
        )}
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
 * A thin naming layer over the shared `SegmentedControl`, Phase 14 drops
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
 * the account *is* the step, the recurring-rule sheet asks for little else.
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

  const card = (
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
      asTrigger
    />
  );

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger asChild aria-label={label} id={id} chevron={false}>
        {card}
      </SelectTrigger>
      <SelectContent>
        {accounts.map((account) => (
          <SelectItem key={account.id} value={account.id}>
            {account.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
