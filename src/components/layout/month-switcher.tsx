"use client";

import * as React from "react";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/**
 * Month stepper for the sticky header.
 *
 * The month lives in the URL as `?m=2026-11`, so Records, Analysis and
 * Budgets all read the same one, a refresh keeps it, and the back button
 * steps through months the way a user expects it to.
 */
export function MonthSwitcher({
  year,
  month,
  /** The latest month worth offering — "today" in the user's timezone. */
  maxYear,
  maxMonth,
}: {
  year: number;
  month: number;
  maxYear: number;
  maxMonth: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pickerOpen, setPickerOpen] = React.useState(false);

  const isCurrent = year === maxYear && month === maxMonth;

  function go(nextYear: number, nextMonth: number) {
    // Clamped here rather than relying on a disabled button: a double tap
    // before the route re-renders would otherwise step into a future month,
    // which has nothing to show.
    const requested = nextYear * 12 + (nextMonth - 1);
    const latest = maxYear * 12 + (maxMonth - 1);
    const target = Math.min(requested, latest);

    const year2 = Math.floor(target / 12);
    const month2 = (target % 12) + 1;

    const next = new URLSearchParams(params.toString());
    next.set("m", `${year2}-${String(month2).padStart(2, "0")}`);
    // replace, not push: stepping through months should not fill the back
    // stack with every month visited on the way.
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  function step(delta: number) {
    const index = Math.max(0, year * 12 + (month - 1) + delta);
    go(Math.floor(index / 12), (index % 12) + 1);
  }

  return (
    <div className="flex items-center gap-0.5">
      <Button
        variant="ghost"
        size="icon-touch"
        className="rounded-full"
        aria-label={`Previous month`}
        onClick={() => step(-1)}
      >
        <ChevronLeft className="size-5" aria-hidden="true" />
      </Button>

      <DropdownMenu open={pickerOpen} onOpenChange={setPickerOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="h-11 min-w-[8.5ch] px-2 text-sm font-semibold tabular-nums"
            aria-label={`${MONTHS[month - 1]} ${year}. Choose a month`}
          >
            {MONTHS[month - 1]} {year}
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="center" className="w-64 p-3">
          <div className="mb-2 flex items-center justify-between">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Previous year"
              onClick={(event) => {
                event.preventDefault();
                go(year - 1, month);
              }}
            >
              <ChevronLeft className="size-4" aria-hidden="true" />
            </Button>

            <span className="text-sm font-semibold tabular-nums">{year}</span>

            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Next year"
              disabled={year >= maxYear}
              onClick={(event) => {
                event.preventDefault();
                go(year + 1, month);
              }}
            >
              <ChevronRight className="size-4" aria-hidden="true" />
            </Button>
          </div>

          <div className="grid grid-cols-3 gap-1">
            {MONTHS.map((label, index) => {
              const value = index + 1;
              const future = year > maxYear || (year === maxYear && value > maxMonth);
              const active = value === month;

              return (
                <button
                  key={label}
                  type="button"
                  disabled={future}
                  onClick={() => {
                    go(year, value);
                    setPickerOpen(false);
                  }}
                  className={cn(
                    "focus-visible:ring-ring h-11 rounded-lg text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:opacity-40",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted",
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      <Button
        variant="ghost"
        size="icon-touch"
        className="rounded-full"
        aria-label="Next month"
        disabled={isCurrent}
        onClick={() => step(1)}
      >
        <ChevronRight className="size-5" aria-hidden="true" />
      </Button>
    </div>
  );
}
