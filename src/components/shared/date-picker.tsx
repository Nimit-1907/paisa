"use client";

import * as React from "react";

import { CalendarClock, CalendarDays } from "lucide-react";
import { Popover as PopoverPrimitive } from "radix-ui";

import { useTimeZone } from "@/components/profile-provider";
import { Calendar, rangePresets } from "@/components/shared/calendar";
import { FieldCard } from "@/components/shared/field-card";
import { SegmentedControl } from "@/components/shared/segmented-control";
import { Button } from "@/components/ui/button";
import {
  type Meridiem,
  digitsOf,
  digitsToIso,
  isoToMasked,
  maskDate,
  maskTime,
  timeDigitsOf,
  timeDigitsToValue,
  valueToTimeParts,
} from "@/lib/date-entry";
import { localToday } from "@/lib/dates";
import { cn } from "@/lib/utils";

/*
 * The app's one way to choose a date.
 *
 *  - `DatePicker`: one day, on a field card that opens the date panel.
 *  - `DateTimePicker`: the same, with a time under the calendar.
 *  - `DateRangeField`: the preset pills and a From and To pair of
 *    `DatePicker`s, for the filters, Analysis and Export.
 *
 * The panel is the same everywhere: the date typed as digits at the top
 * (15112026 is 15/11/2026), the calendar under it, and Today, Clear and
 * Done along the bottom. Nothing in the app uses a native date or time
 * input, and nothing draws a calendar of its own.
 */

/** Today in the profile's time zone, the same day Records calls today. */
export function useToday(): string {
  return localToday(useTimeZone());
}

/** "15 Nov 2026": how the app writes a date. */
export function formatDay(day: string): string {
  // An empty or half-typed value is "", not a RangeError from format().
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return "";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${day}T00:00:00Z`));
}

const PANEL = cn(
  "raised rounded-card z-50 w-[324px] max-w-[calc(100vw-16px)] border p-2",
  "data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95",
  "data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
  "duration-[120ms] motion-reduce:animate-none",
);

/**
 * Where focus goes when the panel opens: the calendar's tab stop.
 *
 * Not the typed field. On a phone, focusing a text input raises the
 * keyboard, and the keyboard covers the calendar the panel was opened to
 * show. A keyboard or screen-reader user still lands inside the panel, on
 * the chosen day, and arrows from there.
 */
function focusCalendar(event: Event) {
  event.preventDefault();
  const panel = event.target as HTMLElement | null;
  const day = panel?.querySelector<HTMLElement>('[role="grid"] [tabindex="0"]');
  (day ?? panel)?.focus();
}

/** The shell every input in the panel shares: 44px, the control radius. */
const FIELD = cn(
  "bg-surface rounded-control flex h-11 items-center border",
  "has-[input:focus-visible]:outline-ink has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2",
);

/**
 * The date typed as digits, the slashes drawn for you.
 *
 * Reports a date only once it is whole and real and inside the bounds; a
 * half-typed one stays on screen and is not handed on, and 31/02 is a typo
 * to fix, not 3 March.
 */
function DateEntry({
  id,
  label,
  value,
  min,
  max,
  onDate,
}: {
  id: string;
  label: string;
  value: string;
  min?: string;
  max?: string;
  onDate: (day: string) => void;
}) {
  const [text, setText] = React.useState(() => isoToMasked(value));
  const [problem, setProblem] = React.useState<string | null>(null);
  const reported = React.useRef(value);

  // A day picked on the calendar, Today or Clear: show it.
  React.useEffect(() => {
    if (value === reported.current) return;
    reported.current = value;
    setText(isoToMasked(value));
    setProblem(null);
  }, [value]);

  function typed(raw: string) {
    const digits = digitsOf(raw);
    setText(maskDate(digits));
    if (digits.length < 8) {
      setProblem(null);
      return;
    }
    const iso = digitsToIso(digits);
    if (!iso) return setProblem("That date does not exist.");
    if (min && iso < min) return setProblem(`Pick ${formatDay(min)} or later.`);
    if (max && iso > max)
      return setProblem(`Pick ${formatDay(max)} or earlier.`);
    setProblem(null);
    reported.current = iso;
    onDate(iso);
  }

  const errorId = `${id}-error`;

  return (
    <div>
      <div className={cn(FIELD, problem && "border-expense")}>
        <CalendarDays
          className="text-text-secondary ml-3 size-4 shrink-0"
          aria-hidden="true"
        />
        <input
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder="DD/MM/YYYY"
          value={text}
          onChange={(event) => typed(event.target.value)}
          onBlur={() => {
            const length = digitsOf(text).length;
            if (length > 0 && length < 8) {
              setProblem("Enter the full date, like 15/11/2026.");
            }
          }}
          aria-label={`${label}, as day, month and year`}
          aria-invalid={Boolean(problem)}
          aria-describedby={problem ? errorId : undefined}
          className="amount placeholder:text-text-secondary h-full min-w-0 flex-1 bg-transparent px-2.5 text-base outline-none"
        />
      </div>
      {problem ? (
        <p id={errorId} role="alert" className="text-expense mt-1 px-1 text-xs">
          {problem}
        </p>
      ) : null}
    </div>
  );
}

/**
 * A time, typed as digits on the twelve-hour clock, with AM and PM beside.
 *
 * Replaces the native time input, which was a spinning wheel on a phone
 * and a different control on every browser. `value` is `HH:MM` on the
 * 24-hour clock either way.
 */
export function TimeInput({
  id,
  value,
  onChange,
  className,
}: {
  id: string;
  value: string;
  onChange: (next: string) => void;
  className?: string;
}) {
  const initial = valueToTimeParts(value);
  const [text, setText] = React.useState(initial.text);
  const [meridiem, setMeridiem] = React.useState<Meridiem>(initial.meridiem);
  const [problem, setProblem] = React.useState<string | null>(null);
  const reported = React.useRef(value);

  React.useEffect(() => {
    if (value === reported.current) return;
    reported.current = value;
    const next = valueToTimeParts(value);
    setText(next.text);
    setMeridiem(next.meridiem);
    setProblem(null);
  }, [value]);

  function report(next: string) {
    reported.current = next;
    // The field and the toggle follow what was understood: 1830 shows as
    // 06:30 with PM chosen.
    const shown = valueToTimeParts(next);
    setMeridiem(shown.meridiem);
    if (next !== value) onChange(next);
  }

  function typed(raw: string) {
    const digits = timeDigitsOf(raw);
    setText(maskTime(digits));
    setProblem(null);
    if (digits.length === 4) {
      const next = timeDigitsToValue(digits, meridiem);
      if (next) report(next);
      else setProblem("That time does not exist.");
    }
  }

  function settle() {
    const digits = timeDigitsOf(text);
    if (digits.length === 0) {
      setText(valueToTimeParts(value).text);
      return;
    }
    const next = timeDigitsToValue(digits, meridiem);
    if (!next) {
      setProblem("Enter a time like 09:30.");
      return;
    }
    setText(valueToTimeParts(next).text);
    report(next);
  }

  const errorId = `${id}-error`;

  return (
    <div className={className}>
      <div className="flex items-center gap-2">
        <label
          htmlFor={id}
          className="text-text-secondary w-10 shrink-0 text-sm font-medium"
        >
          Time
        </label>
        <div
          className={cn(
            FIELD,
            "w-[88px] shrink-0",
            problem && "border-expense",
          )}
        >
          <input
            id={id}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder="hh:mm"
            value={text}
            onChange={(event) => typed(event.target.value)}
            onBlur={settle}
            aria-invalid={Boolean(problem)}
            aria-describedby={problem ? errorId : undefined}
            className="amount placeholder:text-text-secondary h-full w-full min-w-0 bg-transparent px-3 text-center text-base outline-none"
          />
        </div>
        <SegmentedControl
          label="AM or PM"
          className="min-w-0 flex-1"
          value={meridiem}
          onChange={(next) => {
            setMeridiem(next);
            const digits = timeDigitsOf(text);
            const parsed = timeDigitsToValue(digits, next);
            // A 24-hour time typed as such keeps its hour; otherwise the
            // toggle is what moves it.
            if (parsed && Number(digits.slice(0, digits.length - 2)) <= 12) {
              reported.current = parsed;
              if (parsed !== value) onChange(parsed);
            }
          }}
          options={[
            { value: "am", label: "AM" },
            { value: "pm", label: "PM" },
          ]}
        />
      </div>
      {problem ? (
        <p id={errorId} role="alert" className="text-expense mt-1 px-1 text-xs">
          {problem}
        </p>
      ) : null}
    </div>
  );
}

/** The panel's contents: typed date, calendar, optional time, actions. */
function DatePanel({
  id,
  label,
  value,
  range,
  min,
  max,
  clearable,
  onDate,
  onClear,
  onDone,
  children,
}: {
  id: string;
  label: string;
  value: string;
  range?: { from: string; to: string };
  min?: string;
  max?: string;
  clearable: boolean;
  /** `picked` is true for a calendar tap or Today, false for typing. */
  onDate: (day: string, picked: boolean) => void;
  onClear: () => void;
  onDone: () => void;
  /** The time row, for `DateTimePicker`. */
  children?: React.ReactNode;
}) {
  const today = useToday();
  const todayAllowed = (!min || today >= min) && (!max || today <= max);

  return (
    <div className="space-y-2">
      <DateEntry
        id={`${id}-typed`}
        label={label}
        value={value}
        min={min}
        max={max}
        onDate={(day) => onDate(day, false)}
      />

      <Calendar
        selected={value}
        range={range}
        min={min}
        max={max}
        today={today}
        onSelect={(day) => onDate(day, true)}
      />

      {children}

      <div className="flex items-center gap-1 border-t pt-2">
        <Button
          type="button"
          variant="ghost"
          size="touch"
          className="px-3"
          disabled={!todayAllowed}
          onClick={() => onDate(today, true)}
        >
          Today
        </Button>
        {clearable ? (
          <Button
            type="button"
            variant="ghost"
            size="touch"
            className="text-text-secondary px-3"
            disabled={!value}
            onClick={onClear}
          >
            Clear
          </Button>
        ) : null}
        <Button
          type="button"
          size="touch"
          className="ml-auto px-5"
          onClick={onDone}
        >
          Done
        </Button>
      </div>
    </div>
  );
}

type PickerProps = {
  id: string;
  label: string;
  /** Shows `*` beside the label, for a date the form cannot save without. */
  required?: boolean;
  min?: string;
  max?: string;
  /** The range this date is one end of, shaded on the calendar. */
  range?: { from: string; to: string };
  invalid?: boolean;
  className?: string;
};

/**
 * The card's label, with the required marker the forms use.
 *
 * The card's own text is its accessible name ("From 15 Nov 2026"), so
 * there is no `aria-label` to drift from what is drawn; the asterisk is
 * drawn only, and `aria-required` says it.
 */
function cardLabel(label: string, required?: boolean): React.ReactNode {
  if (!required) return label;
  return (
    <>
      {label}
      <span aria-hidden="true" className="text-expense ml-0.5">
        *
      </span>
    </>
  );
}

/**
 * One date: a field card that opens the date panel.
 *
 * Picking a day closes the panel; typing a whole date updates the card and
 * leaves it open, because somebody typing may still be checking it.
 */
export function DatePicker({
  id,
  label,
  value,
  onChange,
  placeholder = "Choose a date",
  clearable = false,
  required,
  min,
  max,
  range,
  invalid = false,
  className,
}: PickerProps & {
  /** `yyyy-mm-dd`, or "". */
  value: string;
  onChange: (next: string) => void;
  /** What the card says with no date: "Any", "No end date". */
  placeholder?: string;
  /** Offer Clear, for a date that may be unset. */
  clearable?: boolean;
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild>
        <FieldCard
          asTrigger
          id={id}
          label={cardLabel(label, required)}
          aria-required={required}
          invalid={invalid}
          className={className}
          icon={
            <CalendarDays
              className="text-text-secondary size-3.5 shrink-0"
              aria-hidden="true"
            />
          }
          value={
            value ? (
              formatDay(value)
            ) : (
              <span className="text-text-secondary font-normal">
                {placeholder}
              </span>
            )
          }
        />
      </PopoverPrimitive.Trigger>

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={6}
          collisionPadding={8}
          onOpenAutoFocus={focusCalendar}
          aria-label={label}
          className={PANEL}
        >
          <DatePanel
            id={id}
            label={label}
            value={value}
            range={range}
            min={min}
            max={max}
            clearable={clearable}
            onDate={(day, picked) => {
              onChange(day);
              if (picked) setOpen(false);
            }}
            onClear={() => {
              onChange("");
              setOpen(false);
            }}
            onDone={() => setOpen(false)}
          />
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

/**
 * A moment: the date panel with a time under the calendar.
 *
 * The card shows the caller's words for it ("Today, 1:30 pm"). Picking a
 * day keeps the panel open here, because the time is the next question;
 * Done closes it.
 */
export function DateTimePicker({
  id,
  label,
  value,
  onChange,
  display,
  required,
  min,
  max,
  invalid = false,
  className,
}: Omit<PickerProps, "range"> & {
  /** Local `yyyy-mm-ddThh:mm`. */
  value: string;
  onChange: (next: string) => void;
  /** The same moment, in words, for the card. */
  display: string;
}) {
  const [open, setOpen] = React.useState(false);
  const today = useToday();
  const [rawDay = "", rawTime = ""] = value.split("T");
  // Both halves always present, so neither can emit "T10:30" or
  // "2026-11-16T".
  const day = rawDay || today;
  const time = rawTime.slice(0, 5) || "00:00";

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild>
        <FieldCard
          asTrigger
          id={id}
          label={cardLabel(label, required)}
          aria-required={required}
          invalid={invalid}
          className={className}
          icon={
            <CalendarClock
              className="text-text-secondary size-3.5 shrink-0"
              aria-hidden="true"
            />
          }
          value={display}
        />
      </PopoverPrimitive.Trigger>

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="end"
          sideOffset={6}
          collisionPadding={8}
          onOpenAutoFocus={focusCalendar}
          aria-label={label}
          className={PANEL}
        >
          <DatePanel
            id={id}
            label={label}
            value={day}
            min={min}
            max={max}
            clearable={false}
            onDate={(next) => onChange(`${next}T${time}`)}
            onClear={() => undefined}
            onDone={() => setOpen(false)}
          >
            <TimeInput
              id={`${id}-time`}
              value={time}
              onChange={(next) => onChange(`${day}T${next}`)}
            />
          </DatePanel>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

/**
 * A range: the named presets, then From and To.
 *
 * Each end is a {@link DatePicker} whose calendar shades the whole range,
 * and each bounds the other, so a range can never run backwards. With
 * `clearable`, a second tap on the active preset clears it and both ends
 * offer Clear, for the filters, where no dates means all of them.
 */
export function DateRangeField({
  id,
  from,
  to,
  onChange,
  max,
  clearable = false,
  placeholder = "Choose a date",
  className,
  "aria-labelledby": labelledBy,
}: {
  id: string;
  /** The visible label above the whole control, if there is one. */
  "aria-labelledby"?: string;
  from: string;
  to: string;
  onChange: (next: { from: string; to: string }) => void;
  /** The last day either end may be. */
  max?: string;
  clearable?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const today = useToday();
  const range = { from, to };

  return (
    <div
      role={labelledBy ? "group" : undefined}
      aria-labelledby={labelledBy}
      className={cn("space-y-2", className)}
    >
      <RangePresetPills
        from={from}
        to={to}
        today={today}
        onSelect={(next) => {
          const same = next.from === from && next.to === to;
          onChange(clearable && same ? { from: "", to: "" } : next);
        }}
      />

      <div className="grid grid-cols-2 gap-2">
        <DatePicker
          id={`${id}-from`}
          label="From"
          value={from}
          range={range}
          max={to || max}
          clearable={clearable}
          placeholder={placeholder}
          onChange={(next) => onChange({ from: next, to })}
        />
        <DatePicker
          id={`${id}-to`}
          label="To"
          value={to}
          range={range}
          min={from || undefined}
          max={max}
          clearable={clearable}
          placeholder={placeholder}
          onChange={(next) => onChange({ from, to: next })}
        />
      </div>
    </div>
  );
}

/** The ranges people ask for by name, as pills. */
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
