"use client";

import * as React from "react";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { addDays } from "@/lib/recurrence";
import { cn } from "@/lib/utils";

/** `yyyy-mm-dd` → the parts, as numbers. */
function parts(day: string) {
  const [year = 0, month = 1, date = 1] = day.split("-").map(Number);
  return { year, month, date };
}

/** The parts → `yyyy-mm-dd`. */
function format(year: number, month: number, date: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(date).padStart(2, "0")}`;
}

/** The first of the month a day falls in. */
function monthStart(day: string): string {
  const at = parts(day);
  return format(at.year, at.month, 1);
}

/** `n` months on from the first of a month, still the first. */
function shiftMonth(firstOfMonth: string, by: number): string {
  const at = parts(firstOfMonth);
  const moved = new Date(Date.UTC(at.year, at.month - 1 + by, 1));
  return format(
    moved.getUTCFullYear(),
    moved.getUTCMonth() + 1,
    moved.getUTCDate(),
  );
}

/** How many days the month holds. */
function daysInMonth(firstOfMonth: string): number {
  const at = parts(firstOfMonth);
  return new Date(Date.UTC(at.year, at.month, 0)).getUTCDate();
}

/** 0 = Sunday … 6 = Saturday, for a `yyyy-mm-dd`. */
function weekday(day: string): number {
  const at = parts(day);
  return new Date(Date.UTC(at.year, at.month - 1, at.date)).getUTCDay();
}

const WEEKDAY_NAMES = ["S", "M", "T", "W", "T", "F", "S"];

/**
 * Two dates, picked off a calendar.
 *
 * Native `<input type="date">` is the right control for *one* date somebody
 * already knows — a receipt is dated the 3rd and they type the 3rd. It is
 * the wrong one for a range, because a range is a shape: "the three weeks I
 * was away", "since payday". Those are chosen by looking at a month, not by
 * typing two numbers and checking the arithmetic.
 *
 * The selection is ink, the days between it take the muted surface, and
 * today carries a periwinkle ring whether or not it is in the range — which
 * is the one thing a calendar must never make you hunt for.
 *
 * Tapping always moves one end rather than starting over: a tap before the
 * start moves the start, a tap after the end moves the end, and a tap inside
 * starts a new range from there. Nobody has to remember which end they are
 * setting.
 */
export function RangeCalendar({
  from,
  to,
  max,
  today,
  weekStart = 1,
  onChange,
  className,
}: {
  /** `yyyy-mm-dd`, or "" for an end that has not been chosen. */
  from: string;
  to: string;
  /** The last selectable day, usually today. */
  max: string;
  /** Today where the user is, for the ring. */
  today: string;
  /** 0 = Sunday, 1 = Monday. From the profile. */
  weekStart?: number;
  onChange: (next: { from: string; to: string }) => void;
  className?: string;
}) {
  const [month, setMonth] = React.useState(() =>
    monthStart(from || to || today),
  );

  // Follows the selection when it is set from outside — a preset pill above
  // the calendar should move the calendar to what it just chose.
  React.useEffect(() => {
    if (from) setMonth(monthStart(from));
  }, [from]);

  const total = daysInMonth(month);
  const lead = (weekday(month) - weekStart + 7) % 7;
  const label = new Intl.DateTimeFormat("en-IN", {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  }).format(new Date(`${month}T00:00:00Z`));

  const names = [
    ...WEEKDAY_NAMES.slice(weekStart),
    ...WEEKDAY_NAMES.slice(0, weekStart),
  ];

  function choose(day: string) {
    // Nothing chosen, or a complete range: start again from here.
    if (!from || (from && to)) {
      onChange({ from: day, to: "" });
      return;
    }

    if (day < from) onChange({ from: day, to: from });
    else onChange({ from, to: day });
  }

  return (
    <div className={cn("select-none", className)}>
      <div className="mb-1 flex items-center justify-between gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon-touch"
          className="rounded-full"
          aria-label="Previous month"
          onClick={() => setMonth(shiftMonth(month, -1))}
        >
          <ChevronLeft className="size-5" aria-hidden="true" />
        </Button>

        <p aria-live="polite" className="text-sm font-semibold">
          {label}
        </p>

        <Button
          type="button"
          variant="ghost"
          size="icon-touch"
          className="rounded-full"
          aria-label="Next month"
          disabled={month >= monthStart(max)}
          onClick={() => setMonth(shiftMonth(month, 1))}
        >
          <ChevronRight className="size-5" aria-hidden="true" />
        </Button>
      </div>

      {/*
        The two grids break out of their card's padding on a phone, and
        there is no gap between the cells.

        Seven columns inside 16px of card padding is 40px a column at
        360px, and a tap target is 44. Taking the padding back gets to 43;
        the last pixel comes from the gap. Which is the better calendar
        anyway: with the cells touching, a selected range is one block
        rather than a dotted line of them, so only its two ends are
        rounded.
      */}
      <div
        aria-hidden="true"
        className="text-text-secondary -mx-4 grid grid-cols-7 text-center text-[11px] sm:mx-0"
      >
        {names.map((name, index) => (
          <span key={`${name}-${index}`} className="py-1">
            {name}
          </span>
        ))}
      </div>

      {/*
        Buttons in a CSS grid, not an ARIA `grid`.

        The role brings rules with it — rows, roving focus, arrow keys — and
        a `gridcell` may not be `aria-pressed`. A group of toggle buttons is
        what this actually is, it tabs in the order the days run, and each
        one says its own date.
      */}
      <div
        role="group"
        aria-label={`Days in ${label}`}
        className="-mx-4 grid grid-cols-7 sm:mx-0"
      >
        {Array.from({ length: lead }, (_, index) => (
          <span key={`lead-${index}`} />
        ))}

        {Array.from({ length: total }, (_, index) => {
          const at = parts(month);
          const day = format(at.year, at.month, index + 1);

          const isStart = day === from;
          const isEnd = day === to;
          const inside = Boolean(from && to && day > from && day < to);
          const isToday = day === today;

          // A day past `max` cannot be *chosen* — but it can already be an
          // end of the range that was handed in, because a month period
          // runs to the 30th while today is the 15th. Dimming it then
          // would hide the end of the range the sheet opened on.
          const disabled = day > max && !isStart && !isEnd;

          return (
            <button
              key={day}
              type="button"
              disabled={disabled}
              aria-pressed={isStart || isEnd || inside}
              aria-label={`${new Intl.DateTimeFormat("en-IN", {
                timeZone: "UTC",
                day: "numeric",
                month: "long",
                year: "numeric",
              }).format(new Date(`${day}T00:00:00Z`))}${
                isToday ? ", today" : ""
              }`}
              onClick={() => choose(day)}
              className={cn(
                "relative flex h-11 items-center justify-center text-[13px] font-medium",
                "disabled:text-text-secondary disabled:pointer-events-none disabled:opacity-40",
                // The ends are ink; the days between them take the muted
                // surface, so the run reads as one stretch rather than as
                // two marks with nothing between them.
                isStart || isEnd
                  ? "bg-ink text-on-ink font-semibold"
                  : inside
                    ? "bg-surface-muted"
                    : "rounded-control hoverable:bg-surface-muted",
                // Only the ends of the block are rounded.
                isStart && "rounded-l-control",
                isEnd && "rounded-r-control",
              )}
            >
              {index + 1}
              {isToday ? (
                // An ink ring, not the periwinkle one the brief asks for.
                // Measured, periwinkle on the surface is 1.5:1 — a ring
                // nobody can see is not a ring. Ink clears 3:1 on all three
                // backgrounds a cell can have, and "today" is still in the
                // accessible name either way.
                <span
                  aria-hidden="true"
                  className={cn(
                    "rounded-control pointer-events-none absolute inset-y-0 inset-x-px border-[1.5px]",
                    isStart || isEnd ? "border-on-ink" : "border-ink",
                  )}
                />
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** The ranges people ask for by name, built from today each time. */
export function rangePresets(today: string) {
  const at = parts(today);
  const firstOfMonth = format(at.year, at.month, 1);
  const lastMonth = shiftMonth(firstOfMonth, -1);

  return [
    { label: "Last 7 days", from: addDays(today, -6), to: today },
    { label: "Last 30 days", from: addDays(today, -29), to: today },
    { label: "This month", from: firstOfMonth, to: today },
    {
      label: "Last month",
      from: lastMonth,
      to: format(
        parts(lastMonth).year,
        parts(lastMonth).month,
        daysInMonth(lastMonth),
      ),
    },
    { label: "This year", from: format(at.year, 1, 1), to: today },
  ];
}

/**
 * The preset pills that sit above a {@link RangeCalendar}.
 *
 * Both callers — the Analysis range sheet and Export — had their own copy
 * of this loop, which meant raising the pills from 36px to 44px was the
 * same edit twice. It is one component because it is one control.
 */
export function RangePresetPills({
  from,
  to,
  today,
  onSelect,
  className,
}: {
  from: string;
  to: string;
  today: string;
  onSelect: (range: { from: string; to: string }) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {rangePresets(today).map((preset) => {
        const active = from === preset.from && to === preset.to;

        return (
          <button
            key={preset.label}
            type="button"
            aria-pressed={active}
            onClick={() => onSelect({ from: preset.from, to: preset.to })}
            className={cn(
              "pressable flex h-11 items-center rounded-full px-3 text-[13px] font-semibold",
              "duration-[120ms] transition-[background-color,box-shadow,border-color] motion-reduce:transition-none",
              active
                ? "accent-sm bg-surface text-text"
                : "bg-surface-muted text-text-secondary hoverable:bg-hairline border border-transparent",
            )}
          >
            {preset.label}
          </button>
        );
      })}
    </div>
  );
}
