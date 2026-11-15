"use client";

import { Check } from "lucide-react";

import { ColorDot } from "@/components/shared/color-dot";
import { Label } from "@/components/ui/label";
import { PRESSABLE } from "@/lib/motion";
import { cn } from "@/lib/utils";

export type AccountOption = {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
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
                "focus-visible:ring-ring relative flex h-11 items-center gap-2 rounded-xl border px-3 text-sm font-semibold focus-visible:ring-2 focus-visible:outline-none",
                active
                  ? "border-primary ring-primary bg-primary/5 ring-1"
                  : "text-muted-foreground hoverable:bg-muted/60",
              )}
            >
              <ColorDot color={account.color} icon={account.icon} size="sm" />
              {account.name}
            </button>
          );
        })}
      </div>
      {error ? (
        <p role="alert" className="text-destructive text-sm">
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
      <ul
        aria-labelledby="category-grid-label"
        className="grid grid-cols-4 gap-1.5 sm:grid-cols-5"
      >
        {categories.map((category) => {
          const active = category.id === value;
          return (
            <li key={category.id}>
              <button
                type="button"
                aria-pressed={active}
                onClick={() => onChange(category.id)}
                className={cn(
                  PRESSABLE,
                  "focus-visible:ring-ring relative flex w-full flex-col items-center gap-1 rounded-xl border px-1 py-2 focus-visible:ring-2 focus-visible:outline-none",
                  active
                    ? "border-primary ring-primary bg-primary/5 ring-1"
                    : "border-transparent hoverable:bg-muted/60",
                )}
              >
                <ColorDot
                  color={category.color}
                  icon={category.icon}
                  className="relative"
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "bg-primary text-primary-foreground absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full",
                      "duration-[120ms] ease-[cubic-bezier(0.2,0,0,1)] motion-safe:transition-transform motion-reduce:transition-none",
                      active ? "scale-100" : "scale-0",
                    )}
                  >
                    <Check className="size-3" strokeWidth={3} />
                  </span>
                </ColorDot>
                <span className="w-full truncate text-center text-label font-semibold">
                  {category.name}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** The segmented Expense / Income / Transfer control. */
const TYPE_TABS = [
  {
    value: "expense" as const,
    label: "Expense",
    pill: "bg-expense-soft",
    ink: "text-expense",
  },
  {
    value: "income" as const,
    label: "Income",
    pill: "bg-income-soft",
    ink: "text-income",
  },
  {
    value: "transfer" as const,
    label: "Transfer",
    pill: "bg-transfer-soft",
    ink: "text-transfer",
  },
];

/**
 * Expense | Income | Transfer, with the indicator sliding between them.
 *
 * One pill that moves, rather than three that fade in and out. The movement
 * is the point: it says the three are one choice with a position, which is
 * what a segmented control means — and it carries the eye from where it was
 * to where it now is, so the change registers without anything flashing.
 *
 * The pill takes the colour of whichever type it has arrived at, so the
 * sheet's accent follows the choice. Both the movement and the colour are
 * transitions on transform and background, which the global reduced-motion
 * rule switches off; with it on, the pill simply appears in the new place.
 */
export function TypeTabs({
  value,
  onChange,
}: {
  value: "expense" | "income" | "transfer";
  onChange: (next: "expense" | "income" | "transfer") => void;
}) {
  const index = Math.max(
    0,
    TYPE_TABS.findIndex((tab) => tab.value === value),
  );

  return (
    <div
      role="radiogroup"
      aria-label="Record type"
      className="bg-muted rounded-control relative grid grid-cols-3 gap-1 p-1"
    >
      {/*
        One third of the track, less the padding either side, moved by whole
        multiples of its own width plus the gap. Decorative: the buttons
        carry the state for anything that is not looking at it.
      */}
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute top-1 bottom-1 left-1 rounded-lg shadow-sm",
          "w-[calc((100%-0.5rem)/3-0.167rem)]",
          "duration-[200ms] ease-[cubic-bezier(0.2,0,0,1)] transition-[transform,background-color] motion-reduce:transition-none",
          TYPE_TABS[index].pill,
        )}
        style={{ transform: `translateX(calc(${index} * (100% + 0.25rem)))` }}
      />

      {TYPE_TABS.map((tab) => {
        const active = value === tab.value;
        return (
          <button
            key={tab.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(tab.value)}
            className={cn(
              "focus-visible:ring-ring relative h-11 rounded-lg text-sm font-semibold focus-visible:ring-2 focus-visible:outline-none",
              "duration-[200ms] transition-colors motion-reduce:transition-none",
              active ? tab.ink : "text-ink-2",
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
