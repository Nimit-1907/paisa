"use client";


import { Tile } from "@/components/shared/tile";
import { Label } from "@/components/ui/label";
import { PRESSABLE } from "@/lib/motion";
import { SegmentedControl } from "@/components/shared/segmented-control";
import { TilePicker } from "@/components/shared/tile-picker";
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

export function CategoryGrid({
  categories,
  value,
  onChange,
  error,
}: {
  categories: CategoryOption[];
  value: string;
  onChange: (id: string) => void;
  error?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label id="category-grid-label">Category</Label>

      {/*
        The shared TilePicker, so the category grid here, the account grid
        in the filters and the icon grid in the category sheet are one
        component. They are the same question asked four times.
      */}
      <TilePicker
        label="Category"
        value={value || null}
        onChange={onChange}
        options={categories.map((category) => ({
          id: category.id,
          name: category.name,
          icon: category.icon,
          tint: category.tint,
        }))}
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
