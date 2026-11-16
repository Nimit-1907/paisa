"use client";

import * as React from "react";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { type MonthBounds, useMonthNav } from "@/hooks/use-month-nav";
import { isOverlayOpen, isPlainKey, isTypingTarget } from "@/lib/keyboard";
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
export function MonthSwitcher({ year, month, maxYear, maxMonth }: MonthBounds) {
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const { go, step, isCurrent } = useMonthNav({
    year,
    month,
    maxYear,
    maxMonth,
  });

  /**
   * Left and right arrows step the month.
   *
   * Registered here rather than in a global shortcut handler because this is
   * the control they drive: on a screen with no month to change, the arrow
   * keys should go on meaning what the browser means by them. The guards are
   * the usual two, not while typing, not while a sheet is open, where the
   * arrows belong to whatever is on top.
   */
  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!isPlainKey(event) || event.shiftKey) return;
      if (isTypingTarget(event.target) || isOverlayOpen()) return;

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        step(-1);
      } else if (event.key === "ArrowRight") {
        if (isCurrent) return;
        event.preventDefault();
        step(1);
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isCurrent, step]);

  return (
    <div className="-ml-2 flex items-center gap-0.5 pb-2">
      <Button
        variant="ghost"
        size="icon-touch"
        className="text-text-secondary hoverable:text-text"
        aria-label={`Previous month`}
        onClick={() => step(-1)}
      >
        <ChevronLeft className="size-5" aria-hidden="true" />
      </Button>

      <DropdownMenu open={pickerOpen} onOpenChange={setPickerOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="text-text h-11 min-w-[8.5ch] px-2 text-sm font-medium tabular-nums"
            aria-label={`${MONTHS[month - 1]} ${year}. Choose a month`}
          >
            {MONTHS[month - 1]} {year}
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="center" className="w-64 p-3">
          <div className="mb-2 flex items-center justify-between">
            <Button
              variant="ghost"
              size="icon-touch"
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
              size="icon-touch"
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
              const future =
                year > maxYear || (year === maxYear && value > maxMonth);
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
                    "rounded-control h-11 text-sm font-semibold transition-colors disabled:opacity-40",
                    active
                      ? "bg-ink text-on-ink"
                      : "hoverable:bg-surface-muted",
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
        className="text-text-secondary hoverable:text-text"
        aria-label="Next month"
        disabled={isCurrent}
        onClick={() => step(1)}
      >
        <ChevronRight className="size-5" aria-hidden="true" />
      </Button>
    </div>
  );
}
