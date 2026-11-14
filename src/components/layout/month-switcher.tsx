"use client";

import * as React from "react";

import { addMonths, format, isSameMonth, startOfMonth } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Month stepper for the sticky header.
 *
 * The current month is resolved after mount, never during render: the server
 * runs in UTC and the phone does not, so "today" can be a different month on
 * each side and the markup would not match. Until then the label holds its
 * width with a non-breaking space, so nothing shifts when it fills in.
 *
 * Phase 2: lift this into the URL (`?m=2026-11`) so the month is shared by
 * Records / Analysis / Budgets and survives a refresh.
 */
export function MonthSwitcher() {
  const [thisMonth, setThisMonth] = React.useState<Date | null>(null);
  const [month, setMonth] = React.useState<Date | null>(null);

  React.useEffect(() => {
    const current = startOfMonth(new Date());
    setThisMonth(current);
    setMonth(current);
  }, []);

  const step = (delta: number) =>
    setMonth((current) => (current ? addMonths(current, delta) : current));

  // Compared against the month captured at mount, never a fresh `new Date()`:
  // reading the clock during render would flip the Next button on its own if
  // the page is left open across a month boundary.
  const isCurrentMonth = !month || !thisMonth || isSameMonth(month, thisMonth);
  const previousLabel = month
    ? `Previous month, ${format(addMonths(month, -1), "MMMM yyyy")}`
    : "Previous month";
  const nextLabel = month
    ? `Next month, ${format(addMonths(month, 1), "MMMM yyyy")}`
    : "Next month";

  return (
    <div className="flex items-center gap-0.5">
      <Button
        variant="ghost"
        size="icon-touch"
        className="rounded-full"
        aria-label={previousLabel}
        disabled={!month}
        onClick={() => step(-1)}
      >
        <ChevronLeft className="size-5" aria-hidden="true" />
      </Button>

      <span
        aria-live="polite"
        className="min-w-[8.5ch] text-center text-sm font-semibold tabular-nums"
      >
        {month ? format(month, "MMM yyyy") : "\u00a0"}
      </span>

      <Button
        variant="ghost"
        size="icon-touch"
        className="rounded-full"
        aria-label={nextLabel}
        disabled={!month || isCurrentMonth}
        onClick={() => step(1)}
      >
        <ChevronRight className="size-5" aria-hidden="true" />
      </Button>
    </div>
  );
}
