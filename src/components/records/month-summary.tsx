import { ArrowDownLeft, ArrowUpRight, Scale } from "lucide-react";

import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

const TILES = [
  {
    label: "Income",
    minor: 0n,
    icon: ArrowDownLeft,
    tone: "text-income bg-income-soft",
  },
  {
    label: "Expense",
    minor: 0n,
    icon: ArrowUpRight,
    tone: "text-expense bg-expense-soft",
  },
  {
    label: "Balance",
    minor: 0n,
    icon: Scale,
    tone: "text-foreground bg-muted",
  },
] as const;

/**
 * Income / expense / balance for the selected month.
 *
 * Phase 2 feeds it real totals from Supabase; the zeros keep the shell honest
 * until then.
 */
export function MonthSummary() {
  return (
    <section aria-label="This month" className="grid grid-cols-3 gap-2">
      {TILES.map(({ label, minor, icon: Icon, tone }) => (
        <div key={label} className="bg-card rounded-xl border px-2.5 py-3">
          <div className="flex items-center gap-1">
            <span
              className={cn(
                "flex size-6 items-center justify-center rounded-lg",
                tone,
              )}
            >
              <Icon className="size-3.5" aria-hidden="true" />
            </span>
            <p className="text-muted-foreground truncate text-[11px] font-medium">
              {label}
            </p>
          </div>
          <p className="amount mt-2 truncate text-base font-semibold sm:text-lg">
            {formatMoney(minor)}
          </p>
        </div>
      ))}
    </section>
  );
}
