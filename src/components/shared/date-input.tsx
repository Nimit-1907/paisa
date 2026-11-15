"use client";

import * as React from "react";

import { CalendarDays } from "lucide-react";
import { Popover as PopoverPrimitive } from "radix-ui";

import { useTimeZone } from "@/components/profile-provider";
import { RangeCalendar } from "@/components/shared/range-calendar";
import { localToday } from "@/lib/dates";
import { digitsOf, digitsToIso, isoToMasked, maskDate } from "@/lib/date-entry";
import { cn } from "@/lib/utils";

/** The date panels' surface, shared by every one of them. */
export const DATE_PANEL = cn(
  "raised rounded-card z-50 w-[324px] max-w-[calc(100vw-16px)] border p-2",
  "data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95",
  "data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
  "duration-[120ms] motion-reduce:animate-none",
);

/** Today in the profile's time zone, the same day Records calls today. */
export function useToday(): string {
  return localToday(useTimeZone());
}


/**
 * Where focus goes when a date panel opens: the chosen day, else the panel.
 *
 * Not the typed field. On a phone, focusing a text input raises the
 * keyboard, and the keyboard covers the calendar the panel was opened to
 * show. A keyboard or screen-reader user still lands inside the panel, on
 * the day that is selected.
 */
export function focusChosenDay(event: Event) {
  event.preventDefault();
  const panel = event.target as HTMLElement | null;
  const chosen = panel?.querySelector<HTMLElement>('[aria-pressed="true"]');
  (chosen ?? panel)?.focus();
}

/** "15 Nov 2026", for the error that names the limit. */
function readable(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${iso}T00:00:00Z`));
}

/**
 * One date, typed or picked.
 *
 * Two ways in, one value out. Typing takes digits only and draws the
 * slashes itself (see `lib/date-entry.ts`), so 15112026 is 15/11/2026 with
 * no hunting for "/" on a number pad. The calendar button beside it opens
 * the same calendar the range filter uses, in single-day mode. Either way
 * the value handed back is `yyyy-mm-dd`, or "" while the field is empty.
 *
 * A half-typed date is kept on screen and reported as not yet a date,
 * rather than snapped to something nearby: 31/02 is a typo to fix, not
 * 3 March.
 */
export function DateInput({
  id,
  value,
  onChange,
  min,
  max,
  invalid = false,
  autoFocus = false,
  calendar = true,
  "aria-describedby": describedBy,
  "aria-required": required,
  "aria-label": ariaLabel,
  className,
}: {
  id: string;
  /** `yyyy-mm-dd`, or "". */
  value: string;
  onChange: (next: string) => void;
  min?: string;
  max?: string;
  invalid?: boolean;
  autoFocus?: boolean;
  /**
   * The calendar button. Off where a calendar is already on screen beside
   * the field, as in a date card's panel.
   */
  calendar?: boolean;
  "aria-describedby"?: string;
  "aria-required"?: true;
  "aria-label"?: string;
  className?: string;
}) {
  const today = useToday();
  const [text, setText] = React.useState(() => isoToMasked(value));
  const [open, setOpen] = React.useState(false);
  const [problem, setProblem] = React.useState<string | null>(null);

  /*
   * The last value this field reported, so an outside change can be told
   * from the echo of our own.
   *
   * The field reports "" whenever it does not hold an accepted date (half
   * typed, impossible, or outside its bounds). The parent therefore never
   * keeps an old date while the field shows a different one: a filter
   * applied with a rejected From is applied with no From, not with the
   * stale one.
   */
  const reported = React.useRef(value);

  function report(next: string) {
    reported.current = next;
    if (next !== value) onChange(next);
  }

  // A preset, a reset, or a calendar pick from a sibling: take it.
  React.useEffect(() => {
    if (value === reported.current) return;
    reported.current = value;
    setText(isoToMasked(value));
    setProblem(null);
  }, [value]);

  function check(iso: string): string | null {
    if (min && iso < min) return `Pick ${readable(min)} or later.`;
    if (max && iso > max) return `Pick ${readable(max)} or earlier.`;
    return null;
  }

  function typed(raw: string) {
    const digits = digitsOf(raw);
    setText(maskDate(digits));

    if (digits.length < 8) {
      setProblem(null);
      report("");
      return;
    }

    const iso = digitsToIso(digits);
    if (!iso) {
      setProblem("That date does not exist.");
      report("");
      return;
    }
    const limit = check(iso);
    setProblem(limit);
    report(limit ? "" : iso);
  }

  function picked(iso: string) {
    setText(isoToMasked(iso));
    setProblem(null);
    report(iso);
    setOpen(false);
  }

  const errorId = `${id}-date-error`;
  const showError = problem;
  const describedByAll =
    [describedBy, showError ? errorId : null].filter(Boolean).join(" ") ||
    undefined;

  return (
    <div className={className}>
      <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
        <div
          className={cn(
            "bg-surface rounded-control flex h-11 items-center border",
            "has-[input:focus-visible]:outline-ink has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2",
            (invalid || showError) && "border-expense",
          )}
        >
          <input
            id={id}
            type="text"
            // A number pad on a phone, which is all a date needs now.
            inputMode="numeric"
            autoComplete="off"
            // eslint-disable-next-line jsx-a11y/no-autofocus -- passed through by a caller that opened a sheet for this field.
            autoFocus={autoFocus}
            placeholder="DD/MM/YYYY"
            value={text}
            onChange={(event) => typed(event.target.value)}
            onBlur={() => {
              const digits = digitsOf(text);
              if (digits.length > 0 && digits.length < 8) {
                setProblem("Enter the full date, like 15/11/2026.");
              }
            }}
            aria-label={ariaLabel}
            aria-invalid={Boolean(invalid || showError)}
            aria-describedby={describedByAll}
            aria-required={required}
            className="amount placeholder:text-text-secondary h-full min-w-0 flex-1 bg-transparent px-3 text-base outline-none"
          />

          {calendar ? (
            <PopoverPrimitive.Trigger asChild>
              <button
                type="button"
                aria-label="Choose from a calendar"
                className="text-text-secondary hoverable:text-text rounded-control flex size-11 shrink-0 items-center justify-center"
              >
                <CalendarDays className="size-5" aria-hidden="true" />
              </button>
            </PopoverPrimitive.Trigger>
          ) : null}
        </div>

        <PopoverPrimitive.Portal>
          <PopoverPrimitive.Content
            align="end"
            sideOffset={6}
            collisionPadding={8}
            onOpenAutoFocus={focusChosenDay}
            className={DATE_PANEL}
          >
            <RangeCalendar
              single
              bleed={false}
              from={value}
              to={value}
              min={min}
              max={max}
              today={today}
              onChange={(next) => picked(next.from)}
            />
          </PopoverPrimitive.Content>
        </PopoverPrimitive.Portal>
      </PopoverPrimitive.Root>

      {showError ? (
        <p id={errorId} role="alert" className="text-expense mt-1.5 text-sm">
          {showError}
        </p>
      ) : null}
    </div>
  );
}
