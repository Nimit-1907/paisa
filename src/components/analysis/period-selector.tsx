"use client";

import * as React from "react";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { CalendarRange, ChevronLeft, ChevronRight } from "lucide-react";

import {
  ResponsiveSheet,
  SheetBody,
  SheetFooter,
} from "@/components/shared/responsive-sheet";
import {
  RangeCalendar,
  RangePresetPills,
} from "@/components/shared/range-calendar";
import { SegmentedControl } from "@/components/shared/segmented-control";
import { Button } from "@/components/ui/button";
import {
  MAX_RANGE_DAYS,
  type Period,
  PERIOD_KINDS,
  PERIOD_LABELS,
  type PeriodKind,
  periodContains,
  periodContaining,
  periodLabel,
  periodParams,
  shiftPeriod,
} from "@/lib/period";
import { dayDifference } from "@/lib/recurrence";

/**
 * Week, month, year or a range of your own, and arrows to walk through them.
 *
 * The period lives in the URL like the month does everywhere else, so a view
 * can be shared or reloaded, and the back button steps through what was
 * actually looked at.
 */
export function PeriodSelector({
  period,
  today,
  weekStart,
}: {
  period: Period;
  /** Today where the user is, `yyyy-mm-dd`. */
  today: string;
  weekStart: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const [rangeOpen, setRangeOpen] = React.useState(false);
  const [from, setFrom] = React.useState(period.from);
  const [to, setTo] = React.useState(period.to);

  React.useEffect(() => {
    if (!rangeOpen) return;
    setFrom(period.from);
    setTo(period.to);
  }, [rangeOpen, period.from, period.to]);

  function go(next: Period) {
    const search = new URLSearchParams(params.toString());

    // The period owns these four and nothing else, so a stale `from` cannot
    // survive a switch back to Month.
    for (const key of ["p", "d", "from", "to"]) search.delete(key);
    for (const [key, value] of Object.entries(periodParams(next))) {
      search.set(key, value);
    }

    // replace, not push: stepping through weeks should not fill the back
    // stack with every week visited on the way.
    router.replace(`${pathname}?${search.toString()}`, { scroll: false });
  }

  function choose(kind: PeriodKind) {
    if (kind === "custom") {
      setRangeOpen(true);
      return;
    }

    // Anchored on today when today is inside what is on screen, so
    // Month → Week lands on this week rather than on the first week of the
    // month. Looking at March, it anchors on March.
    const anchor = periodContains(period, today) ? today : period.from;
    go(periodContaining(kind, anchor, weekStart));
  }

  function step(delta: number) {
    const next = shiftPeriod(period, delta, weekStart);

    // Clamped rather than relying on a disabled button: a double tap before
    // the route re-renders would otherwise walk into a period that has not
    // happened yet.
    if (next.from > today) return;
    go(next);
  }

  const atLatest = shiftPeriod(period, 1, weekStart).from > today;

  // Checked here as well as in parsePeriod, so a range is never accepted by
  // the form and then silently replaced with a different one.
  const rangeError =
    !from || !to
      ? "Pick both dates."
      : from > to
        ? "The start is after the end."
        : dayDifference(from, to) > MAX_RANGE_DAYS
          ? "That range is longer than five years."
          : null;

  return (
    <div className="space-y-2">
      <SegmentedControl
        // Capped on a wide screen. A four-way control stretched across
        // 1200px puts a centimetre of empty track between each label and
        // reads as a navigation bar rather than as a choice.
        className="max-w-md"
        label="Period"
        value={period.kind}
        onChange={choose}
        options={PERIOD_KINDS.map((kind) => ({
          value: kind,
          label: PERIOD_LABELS[kind],
        }))}
      />

      <div className="flex items-center justify-between gap-1">
        <Button
          variant="ghost"
          size="icon-touch"
          className="rounded-full"
          aria-label="Previous period"
          onClick={() => step(-1)}
        >
          <ChevronLeft className="size-5" aria-hidden="true" />
        </Button>

        <button
          type="button"
          onClick={() => setRangeOpen(true)}
          className="rounded-control hoverable:bg-surface-muted min-h-11 min-w-0 flex-1 truncate px-2 text-center text-sm font-semibold"
        >
          {periodLabel(period)}
        </button>

        <Button
          variant="ghost"
          size="icon-touch"
          className="rounded-full"
          aria-label="Next period"
          disabled={atLatest}
          onClick={() => step(1)}
        >
          <ChevronRight className="size-5" aria-hidden="true" />
        </Button>
      </div>

      <ResponsiveSheet
        open={rangeOpen}
        onOpenChange={setRangeOpen}
        title="Choose a range"
        description="Any two dates, up to five years apart."
      >
        <SheetBody>
          {/* The ranges people ask for by name, first. Most custom ranges
              are one of these five, and tapping one is a tap. */}
          <RangePresetPills
            from={from}
            to={to}
            today={today}
            onSelect={(next) => {
              setFrom(next.from);
              setTo(next.to);
            }}
          />

          <RangeCalendar
            from={from}
            to={to}
            max={today}
            today={today}
            weekStart={weekStart}
            onChange={(next) => {
              setFrom(next.from);
              setTo(next.to);
            }}
          />

          <p className="text-text-secondary text-xs">
            {from && to ? (
              <>
                {periodLabel({ kind: "custom", from, to })} ·{" "}
                {dayDifference(from, to) + 1} days
              </>
            ) : from ? (
              "Now pick the other end."
            ) : (
              "Pick the first day."
            )}
          </p>

          {rangeError && from && to ? (
            <p role="alert" className="text-expense text-sm">
              {rangeError}
            </p>
          ) : null}
        </SheetBody>

        <SheetFooter>
          <Button
            variant="outline"
            size="touch"
            className="flex-1"
            onClick={() => setRangeOpen(false)}
          >
            Cancel
          </Button>
          <Button
            size="touch"
            className="flex-1"
            disabled={rangeError !== null || !from || !to}
            onClick={() => {
              setRangeOpen(false);
              go({ kind: "custom", from, to });
            }}
          >
            <CalendarRange className="size-4" aria-hidden="true" />
            Show range
          </Button>
        </SheetFooter>
      </ResponsiveSheet>
    </div>
  );
}
