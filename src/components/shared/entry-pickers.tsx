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
export function TypeTabs({
  value,
  onChange,
}: {
  value: "expense" | "income" | "transfer";
  onChange: (next: "expense" | "income" | "transfer") => void;
}) {
  const tabs = [
    {
      value: "expense" as const,
      label: "Expense",
      className:
        "data-[active=true]:bg-expense-soft data-[active=true]:text-expense",
    },
    {
      value: "income" as const,
      label: "Income",
      className:
        "data-[active=true]:bg-income-soft data-[active=true]:text-income",
    },
    {
      value: "transfer" as const,
      label: "Transfer",
      className:
        "data-[active=true]:bg-transfer-soft data-[active=true]:text-transfer",
    },
  ];

  return (
    <div
      role="radiogroup"
      aria-label="Record type"
      className="bg-muted grid grid-cols-3 gap-1 rounded-xl p-1"
    >
      {tabs.map((tab) => {
        const active = value === tab.value;
        return (
          <button
            key={tab.value}
            type="button"
            role="radio"
            aria-checked={active}
            data-active={active}
            onClick={() => onChange(tab.value)}
            className={cn(
              "focus-visible:ring-ring h-11 rounded-lg text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:outline-none",
              "text-muted-foreground data-[active=true]:bg-background data-[active=true]:shadow-sm",
              tab.className,
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
