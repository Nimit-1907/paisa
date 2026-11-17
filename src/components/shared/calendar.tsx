"use client";

import * as React from "react";

import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";

import { useWeekStart } from "@/components/profile-provider";
import { Button } from "@/components/ui/button";
import { addDays } from "@/lib/recurrence";
import { cn } from "@/lib/utils";

/*
 * Dates here are `yyyy-mm-dd` strings throughout. They compare correctly as
 * text, they are what the server parses, and they carry no time zone to go
 * wrong: the calendar only ever does arithmetic in UTC on them.
 */

/** `yyyy-mm-dd` → the parts, as numbers. */
function parts(day: string) {
  const [year = 0, month = 1, date = 1] = day.split("-").map(Number);
  return { year, month, date };
}

/** The parts → `yyyy-mm-dd`. */
function format(year: number, month: number, date: number): string {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(date).padStart(2, "0")}`;
}

/** The first of the month a day falls in. */
export function monthStart(day: string): string {
  const at = parts(day);
  return format(at.year, at.month, 1);
}

/** `n` months on from the first of a month, still the first. */
export function shiftMonth(firstOfMonth: string, by: number): string {
  const at = parts(firstOfMonth);
  const moved = new Date(Date.UTC(at.year, at.month - 1 + by, 1));
  return format(moved.getUTCFullYear(), moved.getUTCMonth() + 1, 1);
}

/** How many days the month holds. */
export function daysInMonth(firstOfMonth: string): number {
  const at = parts(firstOfMonth);
  return new Date(Date.UTC(at.year, at.month, 0)).getUTCDate();
}

/** The same day `by` months away, clamped to the shorter month's end. */
function sameDayInMonth(day: string, by: number): string {
  const target = shiftMonth(monthStart(day), by);
  const at = parts(target);
  return format(
    at.year,
    at.month,
    Math.min(parts(day).date, daysInMonth(target)),
  );
}

/** 0 = Sunday … 6 = Saturday. */
function weekday(day: string): number {
  const at = parts(day);
  return new Date(Date.UTC(at.year, at.month - 1, at.date)).getUTCDay();
}

const WEEKDAYS = [
  ["Su", "Sunday"],
  ["Mo", "Monday"],
  ["Tu", "Tuesday"],
  ["We", "Wednesday"],
  ["Th", "Thursday"],
  ["Fr", "Friday"],
  ["Sa", "Saturday"],
] as const;

const MONTH_FORMAT = new Intl.DateTimeFormat("en-IN", {
  timeZone: "UTC",
  month: "long",
  year: "numeric",
});

// Written out: en-IN's short September is "Sept", the one four-letter
// name in a grid of three-letter ones.
const SHORT_MONTHS = [
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

const DAY_NAME = new Intl.DateTimeFormat("en-IN", {
  timeZone: "UTC",
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

const asDate = (day: string) => new Date(`${day}T00:00:00Z`);

const clamp = (day: string, min: string, max: string) =>
  day < min ? min : day > max ? max : day;

/**
 * The app's one calendar.
 *
 * Every date in the app is chosen off this: a record's day, a rule's first
 * and last run, the From and To of a filter, an Analysis range and an
 * export. It is drawn inside {@link DatePicker}'s panel and nowhere else.
 *
 * Six full weeks every month, the neighbouring months' days in quiet text,
 * so the panel never changes height under the thumb as months go by and the
 * last days of October are one tap away from 1 November. The caption opens
 * a month and year view, which is how somebody gets to March last year
 * without fourteen taps on an arrow.
 *
 * The chosen day is ink. With a `range`, the days between its two ends take
 * the muted surface and the ends are ink, so a From picker shows what it is
 * the start of. Today is marked with a dot under its number, in the
 * accessible name too.
 *
 * Keyboard: the arrows move a day or a week, Page Up and Page Down a month
 * (with Shift, a year), Home and End to the ends of the week. The grid is
 * the ARIA date-grid pattern: one cell in the tab order at a time.
 */
export function Calendar({
  selected,
  range,
  min = "1900-01-01",
  max = "9999-12-31",
  today,
  onSelect,
  className,
}: {
  /** The day this calendar is choosing, `yyyy-mm-dd`, or "" for none. */
  selected: string;
  /** Shading for the range the selected day is one end of. */
  range?: { from: string; to: string };
  /** The first selectable day. */
  min?: string;
  /** The last selectable day. */
  max?: string;
  /** Today where the user is. */
  today: string;
  onSelect: (day: string) => void;
  className?: string;
}) {
  const weekStart = useWeekStart();
  const [view, setView] = React.useState<"days" | "months">("days");
  const [month, setMonth] = React.useState(() =>
    monthStart(clamp(selected || today, min, max)),
  );
  // The roving tab stop: the one day button that is tabbable.
  const [focusDay, setFocusDay] = React.useState(() =>
    clamp(selected || today, min, max),
  );
  const gridRef = React.useRef<HTMLTableElement>(null);
  // Only move DOM focus when the keyboard asked for it, never on a render
  // that came from the selection changing somewhere else.
  const keyboardMove = React.useRef(false);

  // A typed date, a preset or Today: show the month it is in.
  React.useEffect(() => {
    if (!selected) return;
    setMonth(monthStart(selected));
    // A To that runs past today (a month period ends on the 30th) is
    // shown, but the tab stop has to be a day that can be pressed.
    setFocusDay(clamp(selected, min, max));
  }, [selected, min, max]);

  React.useEffect(() => {
    if (!keyboardMove.current) return;
    keyboardMove.current = false;
    gridRef.current
      ?.querySelector<HTMLButtonElement>(`[data-day="${focusDay}"]`)
      ?.focus();
  }, [focusDay, month]);

  const label = MONTH_FORMAT.format(asDate(month));
  const canGoBack = month > monthStart(min);
  const canGoForward = month < monthStart(max);

  // Six weeks from the first weekStart-day on or before the 1st.
  const lead = (weekday(month) - weekStart + 7) % 7;
  const first = addDays(month, -lead);
  const weeks = Array.from({ length: 6 }, (_, week) =>
    Array.from({ length: 7 }, (_, index) => addDays(first, week * 7 + index)),
  );

  const names = [...WEEKDAYS.slice(weekStart), ...WEEKDAYS.slice(0, weekStart)];

  function moveFocus(next: string) {
    const bounded = clamp(next, min, max);
    keyboardMove.current = true;
    setFocusDay(bounded);
    if (monthStart(bounded) !== month) setMonth(monthStart(bounded));
  }

  function onKeyDown(event: React.KeyboardEvent) {
    const offset = (weekday(focusDay) - weekStart + 7) % 7;
    const moves: Record<string, () => string> = {
      ArrowLeft: () => addDays(focusDay, -1),
      ArrowRight: () => addDays(focusDay, 1),
      ArrowUp: () => addDays(focusDay, -7),
      ArrowDown: () => addDays(focusDay, 7),
      Home: () => addDays(focusDay, -offset),
      End: () => addDays(focusDay, 6 - offset),
      PageUp: () => sameDayInMonth(focusDay, event.shiftKey ? -12 : -1),
      PageDown: () => sameDayInMonth(focusDay, event.shiftKey ? 12 : 1),
    };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    moveFocus(move());
  }

  function goMonth(by: number) {
    const next = shiftMonth(month, by);
    setMonth(next);
    // Keep the tab stop inside the month on screen.
    setFocusDay(clamp(sameDayInMonth(focusDay, by), min, max));
  }

  return (
    <div className={cn("select-none", className)}>
      <div className="flex items-center justify-between gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon-touch"
          aria-label={view === "days" ? "Previous month" : "Previous year"}
          disabled={
            view === "days" ? !canGoBack : parts(month).year <= parts(min).year
          }
          onClick={() => (view === "days" ? goMonth(-1) : goMonth(-12))}
        >
          <ChevronLeft className="size-5" aria-hidden="true" />
        </Button>

        {/* The caption is the way to the month and year view. */}
        <button
          type="button"
          aria-expanded={view === "months"}
          aria-label={
            view === "days"
              ? `${label}. Choose a month or year`
              : `${parts(month).year}. Back to days`
          }
          onClick={() => setView(view === "days" ? "months" : "days")}
          className="rounded-control hoverable:bg-surface-muted flex h-11 min-w-0 items-center gap-1 px-3 text-sm font-semibold"
        >
          <span aria-live="polite" className="truncate">
            {view === "days" ? label : parts(month).year}
          </span>
          <ChevronDown
            className={cn(
              "text-text-secondary size-4 shrink-0 transition-transform duration-[120ms] motion-reduce:transition-none",
              view === "months" && "rotate-180",
            )}
            aria-hidden="true"
          />
        </button>

        <Button
          type="button"
          variant="ghost"
          size="icon-touch"
          aria-label={view === "days" ? "Next month" : "Next year"}
          disabled={
            view === "days"
              ? !canGoForward
              : parts(month).year >= parts(max).year
          }
          onClick={() => (view === "days" ? goMonth(1) : goMonth(12))}
        >
          <ChevronRight className="size-5" aria-hidden="true" />
        </Button>
      </div>

      {view === "months" ? (
        <MonthGrid
          month={month}
          selected={selected}
          today={today}
          min={min}
          max={max}
          onChoose={(next) => {
            setMonth(next);
            setFocusDay(
              clamp(
                format(
                  parts(next).year,
                  parts(next).month,
                  Math.min(parts(focusDay).date, daysInMonth(next)),
                ),
                min,
                max,
              ),
            );
            setView("days");
          }}
        />
      ) : (
        <table
          ref={gridRef}
          // eslint-disable-next-line jsx-a11y/no-noninteractive-element-to-interactive-role -- the WAI-ARIA date picker pattern is a table with role="grid": its rows, headers and cells are what a screen reader navigates by.
          role="grid"
          aria-label={label}
          onKeyDown={onKeyDown}
          className="mt-1 w-full table-fixed border-collapse"
        >
          <thead>
            <tr>
              {names.map(([short, long]) => (
                <th
                  key={long}
                  scope="col"
                  abbr={long}
                  className="text-text-secondary h-8 text-center text-xs font-semibold"
                >
                  {short}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weeks.map((days) => (
              <tr key={days[0]}>
                {days.map((day) => (
                  <DayCell
                    key={day}
                    day={day}
                    outside={monthStart(day) !== month}
                    selected={day === selected}
                    range={range}
                    today={day === today}
                    disabled={day < min || day > max}
                    tabbable={day === focusDay}
                    onChoose={() => {
                      setFocusDay(day);
                      onSelect(day);
                    }}
                  />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function DayCell({
  day,
  outside,
  selected,
  range,
  today,
  disabled,
  tabbable,
  onChoose,
}: {
  day: string;
  outside: boolean;
  selected: boolean;
  range?: { from: string; to: string };
  today: boolean;
  disabled: boolean;
  tabbable: boolean;
  onChoose: () => void;
}) {
  const from = range?.from ?? "";
  const to = range?.to ?? "";
  const isEnd =
    selected || (Boolean(from) && day === from) || (Boolean(to) && day === to);
  const inside = Boolean(from && to && day > from && day < to);
  // The shaded band runs edge to edge behind the ends, so a range reads as
  // one stretch. Each end only paints the half that faces the other.
  const bandLeft = Boolean(from && to && from !== to && day === to);
  const bandRight = Boolean(from && to && from !== to && day === from);

  return (
    // A `td` in a `role="grid"` table is a gridcell already.
    <td aria-selected={selected} className="relative h-11 p-0 text-center">
      {inside || bandLeft || bandRight ? (
        <span
          aria-hidden="true"
          className={cn(
            "bg-surface-muted absolute inset-y-0",
            inside && "inset-x-0",
            bandLeft && "right-1/2 left-0",
            bandRight && "right-0 left-1/2",
          )}
        />
      ) : null}
      <button
        type="button"
        data-day={day}
        tabIndex={tabbable ? 0 : -1}
        disabled={disabled}
        aria-label={`${DAY_NAME.format(asDate(day))}${today ? ", today" : ""}`}
        aria-current={today ? "date" : undefined}
        onClick={onChoose}
        className={cn(
          "rounded-control relative mx-auto flex size-11 max-w-full flex-col items-center justify-center text-[13px] font-medium tabular-nums",
          "focus-visible:outline-ink focus-visible:outline-2 focus-visible:outline-offset-1",
          "disabled:pointer-events-none disabled:opacity-35",
          "duration-[80ms] transition-colors motion-reduce:transition-none",
          isEnd
            ? "bg-ink text-on-ink font-semibold"
            : cn(
                "hoverable:bg-hairline",
                outside ? "text-text-secondary" : "text-text",
                today && "font-bold",
              ),
        )}
      >
        {parts(day).date}
        {today ? (
          <span
            aria-hidden="true"
            className={cn(
              "absolute bottom-1.5 size-1 rounded-full",
              isEnd ? "bg-on-ink" : "bg-ink",
            )}
          />
        ) : null}
      </button>
    </td>
  );
}

/** Twelve months and the year above them, for the long jumps. */
function MonthGrid({
  month,
  selected,
  today,
  min,
  max,
  onChoose,
}: {
  month: string;
  selected: string;
  today: string;
  min: string;
  max: string;
  onChoose: (firstOfMonth: string) => void;
}) {
  const year = parts(month).year;

  return (
    <div
      role="group"
      aria-label={`Months in ${year}`}
      className="mt-1 grid grid-cols-3 gap-1"
    >
      {Array.from({ length: 12 }, (_, index) => {
        const first = format(year, index + 1, 1);
        const lastDay = format(year, index + 1, daysInMonth(first));
        const disabled = lastDay < min || first > max;
        const chosen = Boolean(selected) && monthStart(selected) === first;
        const current = monthStart(today) === first;

        return (
          <button
            key={first}
            type="button"
            disabled={disabled}
            aria-pressed={chosen}
            aria-label={MONTH_FORMAT.format(asDate(first))}
            onClick={() => onChoose(first)}
            className={cn(
              "rounded-control flex h-12 items-center justify-center text-sm font-medium",
              "disabled:pointer-events-none disabled:opacity-35",
              chosen
                ? "bg-ink text-on-ink font-semibold"
                : cn(
                    "hoverable:bg-hairline",
                    current && "border-ink border-[1.5px] font-semibold",
                  ),
            )}
          >
            {SHORT_MONTHS[index]}
          </button>
        );
      })}
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
