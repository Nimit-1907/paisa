"use client";

import { DynamicIcon } from "@/components/shared/dynamic-icon";
import { Label } from "@/components/ui/label";
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
      <Label htmlFor={id}>{label}</Label>
      <div id={id} className="flex flex-wrap gap-1.5">
        {accounts.map((account) => {
          const active = account.id === value;
          return (
            <button
              key={account.id}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(account.id)}
              className={cn(
                "focus-visible:ring-ring flex h-11 items-center gap-2 rounded-xl border px-3 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none",
                active
                  ? "border-primary bg-primary/5"
                  : "text-muted-foreground hover:bg-muted/60",
              )}
            >
              <span
                className="flex size-6 items-center justify-center rounded-full text-white"
                style={{ backgroundColor: account.color ?? "#64748B" }}
              >
                <DynamicIcon name={account.icon} className="size-3.5" />
              </span>
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
      <Label>Category</Label>
      <ul className="grid grid-cols-4 gap-1.5 sm:grid-cols-5">
        {categories.map((category) => {
          const active = category.id === value;
          return (
            <li key={category.id}>
              <button
                type="button"
                aria-pressed={active}
                onClick={() => onChange(category.id)}
                className={cn(
                  "focus-visible:ring-ring flex w-full flex-col items-center gap-1 rounded-xl border px-1 py-2 transition-colors focus-visible:ring-2 focus-visible:outline-none",
                  active
                    ? "border-primary bg-primary/5"
                    : "border-transparent hover:bg-muted/60",
                )}
              >
                <span
                  className="flex size-9 items-center justify-center rounded-full text-white"
                  style={{ backgroundColor: category.color ?? "#64748B" }}
                >
                  <DynamicIcon name={category.icon} className="size-[18px]" />
                </span>
                <span className="w-full truncate text-center text-[11px] font-medium">
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
              "focus-visible:ring-ring h-11 rounded-lg text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none",
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
