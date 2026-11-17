"use client";

import * as React from "react";

import { CalendarClock, CalendarDays, Clock, Keyboard } from "lucide-react";
import { Popover as PopoverPrimitive, Slot } from "radix-ui";

import { useTimeZone } from "@/components/profile-provider";
import { Calendar, rangePresets } from "@/components/shared/calendar";
import { FieldCard } from "@/components/shared/field-card";
import { useFocusReturn } from "@/components/shared/responsive-sheet";
import { SegmentedControl } from "@/components/shared/segmented-control";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
} from "@/components/ui/drawer";
import { useIsDesktop } from "@/hooks/use-media-query";
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
 *  - `DateTimeRow`: a moment as two plain buttons, date and time, for the
 *    bottom of the Add Record screen.
 *  - `DateRangeField`: the preset pills and a From and To pair of
 *    `DatePicker`s, for the filters, Analysis and Export.
 *
 * The panel is the same everywhere: the field's name and the chosen day
 * in words at the top, with a keyboard button that swaps the words for the
 * date typed as digits (15112026 is 15/11/2026); the calendar under it;
 * and Today, Clear and Done along the bottom. On a phone it is a bottom
 * sheet, as every form is, and from `lg` a popover beside its field.
 * Nothing in the app uses a native date or time input, and nothing draws
 * a calendar of its own.
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

const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_SHORT = [
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

/** "Tue, 17 Nov 2026": the panel's heading. Written out, not Intl's "Sept". */
function longDay(day: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return "";
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${WEEKDAY_SHORT[weekday]}, ${d} ${MONTH_SHORT[m - 1]} ${y}`;
}

const PANEL = cn(
  "raised rounded-card z-50 w-[328px] max-w-[calc(100vw-16px)] border p-3",
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
  focusOnMount = false,
  onDate,
}: {
  id: string;
  label: string;
  value: string;
  min?: string;
  max?: string;
  /** Asked for by the keyboard button, so the keyboard rising is wanted. */
  focusOnMount?: boolean;
  onDate: (day: string) => void;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => {
    if (focusOnMount) inputRef.current?.focus();
  }, [focusOnMount]);
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
        <input
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder="DD/MM/YYYY"
          ref={inputRef}
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
          className="amount placeholder:text-text-secondary h-full min-w-0 flex-1 bg-transparent px-3 text-base outline-none"
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
  hideLabel = false,
  className,
}: {
  id: string;
  value: string;
  onChange: (next: string) => void;
  /** For a panel whose heading already says Time. */
  hideLabel?: boolean;
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
          className={cn(
            "text-text min-w-0 flex-1 text-sm font-medium",
            hideLabel && "sr-only",
          )}
        >
          Time
        </label>
        <div
          className={cn(
            FIELD,
            hideLabel ? "min-w-0 flex-1" : "w-[96px] shrink-0",
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
          className="w-[120px] shrink-0"
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

/** True inside the phone's sheet, where the panel's label is its title. */
const InSheet = React.createContext(false);

/**
 * Where a panel opens: a bottom sheet on a phone, a popover from `lg`.
 *
 * A popover over a sheet on a 360px screen was a white card over a white
 * form, covering the fields it belonged to with nothing to say it was on
 * top. The sheet is how every other form in the app opens, it has the
 * page dimmed behind it, and it sits where the thumb is.
 */
function PickerSurface({
  open,
  onOpenChange,
  label,
  trigger,
  side = "right",
  align = "start",
  autoFocusCalendar = true,
  className,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  label: string;
  /** The button that opens it. */
  trigger: React.ReactElement;
  /**
   * Beside the field by default: the panel is taller than the space above
   * or below a field halfway down a dialog, and only to the side can it
   * slide up or down to fit.
   */
  side?: "top" | "bottom" | "right";
  align?: "start" | "end";
  autoFocusCalendar?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const isDesktop = useIsDesktop();
  // The sheet has no trigger of its own to hand focus back to.
  useFocusReturn(!isDesktop && open);

  if (isDesktop) {
    return (
      <PopoverPrimitive.Root open={open} onOpenChange={onOpenChange}>
        <PopoverPrimitive.Trigger asChild>{trigger}</PopoverPrimitive.Trigger>
        <PopoverPrimitive.Portal>
          <PopoverPrimitive.Content
            side={side}
            align={align}
            sideOffset={8}
            collisionPadding={12}
            onOpenAutoFocus={autoFocusCalendar ? focusCalendar : undefined}
            aria-label={label}
            className={cn(
              PANEL,
              "max-h-(--radix-popover-content-available-height) overflow-y-auto",
              className,
            )}
          >
            {children}
          </PopoverPrimitive.Content>
        </PopoverPrimitive.Portal>
      </PopoverPrimitive.Root>
    );
  }

  return (
    <>
      <Slot.Root
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => onOpenChange(true)}
      >
        {trigger}
      </Slot.Root>
      <Drawer open={open} onOpenChange={onOpenChange} repositionInputs={false}>
        <DrawerContent
          onOpenAutoFocus={autoFocusCalendar ? focusCalendar : undefined}
          className="px-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
        >
          <DrawerDescription className="sr-only">
            Choose the {label.toLowerCase()}.
          </DrawerDescription>
          <InSheet.Provider value={true}>
            <div className="mx-auto w-full max-w-sm pt-4">{children}</div>
          </InSheet.Provider>
        </DrawerContent>
      </Drawer>
    </>
  );
}

/** The panel's label: the sheet's title on a phone, a caption in a popover. */
function PanelLabel({ children }: { children: React.ReactNode }) {
  const inSheet = React.useContext(InSheet);
  const className = "text-text-secondary text-[13px] font-medium";
  return inSheet ? (
    <DrawerTitle asChild>
      <p className={cn(className, "font-sans tracking-normal")}>{children}</p>
    </DrawerTitle>
  ) : (
    <p className={className}>{children}</p>
  );
}

/** The figure at the top of a panel: the chosen day or time, in words. */
function PanelFigure({
  children,
  muted = false,
}: {
  children: React.ReactNode;
  muted?: boolean;
}) {
  return (
    <p
      aria-live="polite"
      className={cn(
        "font-display flex h-11 items-center truncate text-[26px] leading-none tracking-[-0.02em]",
        muted ? "text-text-secondary" : "text-text",
      )}
    >
      {children}
    </p>
  );
}

/** The panel's contents: the day in words, calendar, optional time, actions. */
function DatePanel({
  id,
  label,
  value,
  range,
  min,
  max,
  clearable,
  placeholder = "No date",
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
  /** What the heading says with no date. */
  placeholder?: string;
  /** `picked` is true for a calendar tap or Today, false for typing. */
  onDate: (day: string, picked: boolean) => void;
  onClear: () => void;
  onDone: () => void;
  /** The time row, for `DateTimePicker`. */
  children?: React.ReactNode;
}) {
  const today = useToday();
  const todayAllowed = (!min || today >= min) && (!max || today <= max);
  const [typing, setTyping] = React.useState(false);

  return (
    <div>
      <div className="flex items-end gap-2 px-1 pb-3">
        <div className="min-w-0 flex-1">
          <PanelLabel>{label}</PanelLabel>
          <div className="mt-1">
            {typing ? (
              <DateEntry
                id={`${id}-typed`}
                label={label}
                value={value}
                min={min}
                max={max}
                focusOnMount
                onDate={(day) => onDate(day, false)}
              />
            ) : (
              <PanelFigure muted={!value}>
                {value ? longDay(value) : placeholder}
              </PanelFigure>
            )}
          </div>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="icon-touch"
          aria-pressed={typing}
          aria-label={typing ? "Stop typing the date" : "Type the date"}
          className="shrink-0"
          onClick={() => setTyping(!typing)}
        >
          {typing ? (
            <CalendarDays className="size-[18px]" aria-hidden="true" />
          ) : (
            <Keyboard className="size-[18px]" aria-hidden="true" />
          )}
        </Button>
      </div>

      <div className="border-t pt-2">
        <Calendar
          selected={value}
          range={range}
          min={min}
          max={max}
          today={today}
          onSelect={(day) => onDate(day, true)}
        />
      </div>

      {children ? <div className="mt-2 border-t pt-3">{children}</div> : null}

      <div className="mt-2 flex items-center gap-1 border-t pt-3">
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
          className="ml-auto px-6"
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
    <PickerSurface
      open={open}
      onOpenChange={setOpen}
      label={label}
      trigger={
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
      }
    >
      <DatePanel
        id={id}
        label={label}
        value={value}
        range={range}
        min={min}
        max={max}
        clearable={clearable}
        placeholder={placeholder}
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
    </PickerSurface>
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
    <PickerSurface
      open={open}
      onOpenChange={setOpen}
      label={label}
      align="end"
      trigger={
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
      }
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
    </PickerSurface>
  );
}

/** "Today, 16 Nov", "Yesterday, 15 Nov" or "Mon, 9 Nov 2026". */
function dayButtonLabel(day: string, today: string): string {
  const [y = "1970", m = "01", d = "01"] = day.split("-");
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  const short = new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(date);

  if (day === today) return `Today, ${short}`;

  const [ty = "1970", tm = "01", td = "01"] = today.split("-");
  const yesterday = new Date(
    Date.UTC(Number(ty), Number(tm) - 1, Number(td) - 1),
  )
    .toISOString()
    .slice(0, 10);
  if (day === yesterday) return `Yesterday, ${short}`;

  return new Intl.DateTimeFormat("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

/** "10:12 pm" from "22:12". */
function clockLabel(time: string): string {
  const parts = valueToTimeParts(time);
  return parts.text
    ? `${parts.text.replace(/^0/, "")} ${parts.meridiem}`
    : time;
}

const ROW_BUTTON = cn(
  "text-text hoverable:bg-surface-muted rounded-control flex h-12 min-w-0 items-center justify-center gap-2 px-2 text-sm font-semibold",
  "focus-visible:ring-ring/50 outline-none focus-visible:ring-[3px]",
);

/**
 * A moment as two plain buttons, date and time, side by side.
 *
 * The bottom row of the Add Record screen. Each opens the same panel the
 * rest of the app uses: the date one the date panel (picking a day closes
 * it), the time one the typed time with AM and PM.
 */
export function DateTimeRow({
  id,
  value,
  onChange,
  invalid = false,
  className,
}: {
  id: string;
  /** Local `yyyy-mm-ddThh:mm`. */
  value: string;
  onChange: (next: string) => void;
  invalid?: boolean;
  className?: string;
}) {
  const [dateOpen, setDateOpen] = React.useState(false);
  const [timeOpen, setTimeOpen] = React.useState(false);
  const today = useToday();
  const [rawDay = "", rawTime = ""] = value.split("T");
  const day = rawDay || today;
  const time = rawTime.slice(0, 5) || "00:00";
  const dayLabel = dayButtonLabel(day, today);
  const timeLabel = clockLabel(time);

  return (
    <div
      className={cn(
        "grid grid-cols-[1fr_auto_1fr] items-center",
        invalid && "ring-expense rounded-control ring-2",
        className,
      )}
    >
      <PickerSurface
        open={dateOpen}
        onOpenChange={setDateOpen}
        label="Date"
        side="top"
        trigger={
          <button
            type="button"
            id={id}
            aria-label={`Date, ${dayLabel}`}
            className={ROW_BUTTON}
          >
            <CalendarDays
              className="text-text-secondary size-4 shrink-0"
              aria-hidden="true"
            />
            <span className="truncate">{dayLabel}</span>
          </button>
        }
      >
        <DatePanel
          id={`${id}-date`}
          label="Date"
          value={day}
          clearable={false}
          onDate={(next, picked) => {
            onChange(`${next}T${time}`);
            if (picked) setDateOpen(false);
          }}
          onClear={() => undefined}
          onDone={() => setDateOpen(false)}
        />
      </PickerSurface>

      <span aria-hidden="true" className="bg-hairline h-6 w-px" />

      <PickerSurface
        open={timeOpen}
        onOpenChange={setTimeOpen}
        label="Time"
        side="top"
        align="end"
        autoFocusCalendar={false}
        className="w-[300px]"
        trigger={
          <button
            type="button"
            aria-label={`Time, ${timeLabel}`}
            className={ROW_BUTTON}
          >
            <Clock
              className="text-text-secondary size-4 shrink-0"
              aria-hidden="true"
            />
            <span className="truncate">{timeLabel}</span>
          </button>
        }
      >
        <div className="px-1 pb-3">
          <PanelLabel>Time</PanelLabel>
          <div className="mt-1">
            <PanelFigure>{timeLabel}</PanelFigure>
          </div>
        </div>
        <div className="border-t pt-3">
          <TimeInput
            id={`${id}-time`}
            hideLabel
            value={time}
            onChange={(next) => onChange(`${day}T${next}`)}
          />
        </div>
        <div className="mt-3 flex justify-end border-t pt-3">
          <Button
            type="button"
            size="touch"
            className="px-6"
            onClick={() => setTimeOpen(false)}
          >
            Done
          </Button>
        </div>
      </PickerSurface>
    </div>
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
  min,
  max,
  presets,
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
  /** The first day either end may be. */
  min?: string;
  /** The last day either end may be. */
  max?: string;
  /**
   * Pills to show in place of the usual ranges, for a field that only
   * covers part of the calendar (the Records filter, one month).
   */
  presets?: { label: string; from: string; to: string }[];
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
        presets={presets}
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
          min={min}
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
          min={from || min}
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
  presets,
  onSelect,
  className,
}: {
  from: string;
  to: string;
  today: string;
  /** In place of the usual ranges. */
  presets?: { label: string; from: string; to: string }[];
  onSelect: (range: { from: string; to: string }) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {(presets ?? rangePresets(today)).map((preset) => {
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
