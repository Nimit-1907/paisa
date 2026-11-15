"use client";

import * as React from "react";

import { Delete, Equal } from "lucide-react";

import { useCurrency, useFormatMoney } from "@/components/profile-provider";
import { evaluate, isExpression, pressKey } from "@/lib/calculator";
import { cn } from "@/lib/utils";

/**
 * What a physical keyboard types, in the characters the parser knows.
 *
 * `*` and `/` are what the keys are actually labelled, and the sum they make
 * is the same sum; rejecting them would have shown "Not a number" to someone
 * typing `1200/3` perfectly reasonably.
 */
function fromKeyboard(text: string): string {
  return text
    .replace(/[*x]/gi, "×")
    .replace(/\//g, "÷")
    .replace(/[^\d.+\-×÷]/g, "");
}

/** Minor units back to the text the field holds, the way a calculator does. */
function resolved(minor: bigint, decimals: number): string {
  const factor = 10n ** BigInt(decimals);
  const whole = minor / factor;

  if (decimals === 0) return whole.toString();

  const fraction = (minor % factor).toString().padStart(decimals, "0");
  return `${whole}.${fraction}`;
}

const KEYS = [
  ["7", "8", "9", "÷"],
  ["4", "5", "6", "×"],
  ["1", "2", "3", "-"],
  [".", "0", "backspace", "+"],
] as const;

type AmountProps = {
  /** The raw expression, e.g. "120+45". */
  value: string;
  onChange: (next: string) => void;
  /**
   * Which sign and colour the symbol takes.
   *
   * `neutral` is for an amount that is not a movement of money — a budget
   * limit, a starting balance. Those have no direction, and a minus sign in
   * front of a budget says the opposite of what a budget is.
   */
  tone: "expense" | "income" | "transfer" | "neutral";
};

/**
 * The amount, as the headline of the sheet.
 *
 * Phase 14 takes it out of its grey box and sets it centred in the display
 * face at 48px, with the sign and the currency symbol in the money colour
 * and the digits in ink — which is the reference's arrangement, and the
 * reason the sign is legible at all at that size.
 *
 * Separate from {@link Keypad} because the two are no longer adjacent: the
 * reference puts the note, the categories and the two field cards between
 * them, so the amount reads as the thing you are naming rather than as the
 * display on a calculator.
 *
 * There is a visually hidden input behind it so a physical keyboard still
 * works on desktop, where tapping a 4×4 grid would be the slower way.
 */
export function AmountDisplay({
  value,
  onChange,
  tone,
  focusOnOpen = false,
  invalid = false,
  error,
  shaking = false,
  onEnter,
  inputRef,
}: AmountProps & {
  /** Put the caret in the amount when the sheet opens. */
  focusOnOpen?: boolean;
  /** The save was refused because of this field. */
  invalid?: boolean;
  /** Why it was refused, in words. Shown in place of the running total. */
  error?: string;
  /** One short shake, already filtered for reduced motion by the caller. */
  shaking?: boolean;
  /** Enter on a physical keyboard: save, the way a form would. */
  onEnter?: () => void;
  /** Shared with the keypad, so a tapped key puts the caret back. */
  inputRef?: React.RefObject<HTMLInputElement | null>;
}) {
  const currency = useCurrency();
  const formatMoney = useFormatMoney();
  const ownRef = React.useRef<HTMLInputElement>(null);
  const ref = inputRef ?? ownRef;

  const result = evaluate(value || "0", currency.decimals);
  const showsSum = isExpression(value);

  const toneClass =
    tone === "income"
      ? "text-income"
      : tone === "transfer"
        ? "text-transfer"
        : tone === "neutral"
          ? "text-text-secondary"
          : "text-expense";

  return (
    <label
      htmlFor="amount-field"
      className={cn(
        "block px-2 text-center",
        // The outline is the message under reduced motion, where the shake
        // never fires; with motion on, both happen.
        invalid && "rounded-card ring-expense ring-2",
        shaking && "shake",
      )}
    >
      <input
        id="amount-field"
        ref={ref}
        // Not a number input: it has to hold "120+45" as well as "165".
        type="text"
        inputMode="decimal"
        autoComplete="off"
        // eslint-disable-next-line jsx-a11y/no-autofocus -- the sheet has just been opened, and the amount is what it was opened to take.
        autoFocus={focusOnOpen}
        aria-label="Amount"
        value={value}
        onChange={(event) => onChange(fromKeyboard(event.target.value))}
        onKeyDown={(event) => {
          if (event.key !== "Enter") return;
          // A keypad is not a form, so Enter would otherwise do nothing on
          // the one screen a desktop user types the most into.
          event.preventDefault();
          if (isExpression(value) && result.ok) {
            onChange(resolved(result.minor, currency.decimals));
            return;
          }
          onEnter?.();
        }}
        className="peer sr-only"
      />

      <p
        aria-hidden="true"
        className={cn(
          "font-display amount-hero text-text truncate text-[48px] leading-none tracking-[-0.03em] tabular-nums",
          // A caret, because on a desktop this is a text field with no box
          // around it and nothing else would say so. Steady rather than
          // blinking: a blink is an animation, and this one would run for
          // as long as the sheet is open.
          "after:bg-ink after:ml-1 after:inline-block after:h-[0.78em] after:w-[3px] after:translate-y-[0.06em] after:opacity-0 peer-focus:after:opacity-100",
          !value && "text-text-secondary",
        )}
      >
        <span className={cn("amount-unit", value && toneClass)}>
          {tone === "income" ? "+" : tone === "expense" ? "−" : ""}
          {currency.symbol}
        </span>
        {value || "0"}
      </p>

      <p
        aria-live="polite"
        className={cn(
          "mt-1 h-4 text-xs",
          result.ok && !invalid ? "text-text-secondary" : "text-expense",
        )}
      >
        {error
          ? error
          : !result.ok
            ? result.error
            : showsSum
              ? `= ${formatMoney(result.minor)}`
              : " "}
      </p>
    </label>
  );
}

/**
 * The twelve keys, and the one that works the sum out.
 *
 * A keypad rather than a number input, because the arithmetic is the point:
 * people log "120+45" when they split a bill, and making them do that sum in
 * their head is how an amount ends up wrong.
 */
export function Keypad({
  value,
  onChange,
  inputRef,
  className,
}: Omit<AmountProps, "tone"> & {
  inputRef?: React.RefObject<HTMLInputElement | null>;
  className?: string;
}) {
  const currency = useCurrency();
  const result = evaluate(value || "0", currency.decimals);
  const showsSum = isExpression(value);

  const press = (key: string) => {
    onChange(pressKey(value, key));
    inputRef?.current?.focus();
  };

  return (
    // Hidden where there is a real keyboard. A 4×4 grid of buttons is the
    // slower way to type a number on a desktop, and it is 210px of a dialog
    // that the category grid needs more.
    <div className={cn("space-y-1.5 lg:hidden", className)}>
      <div className="grid grid-cols-4 gap-1.5">
        {KEYS.flat().map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => press(key)}
            aria-label={key === "backspace" ? "Backspace" : key}
            // Flat muted keys with no borders: twelve outlined boxes in a
            // grid is a lot of line for something a thumb aims at by
            // position rather than by edge.
            className={cn(
              "pressable rounded-control bg-surface-muted text-text flex h-12 items-center justify-center text-lg font-semibold",
              "hoverable:bg-hairline",
            )}
          >
            {key === "backspace" ? (
              <Delete className="size-5" aria-hidden="true" />
            ) : (
              key
            )}
          </button>
        ))}
      </div>

      {showsSum ? (
        <button
          type="button"
          onClick={() => {
            if (!result.ok) return;
            onChange(resolved(result.minor, currency.decimals));
          }}
          disabled={!result.ok}
          className="bg-surface-muted text-text hoverable:bg-hairline rounded-control flex h-11 w-full items-center justify-center gap-2 text-sm font-semibold transition-colors disabled:opacity-50"
        >
          <Equal className="size-4" aria-hidden="true" />
          Work it out
        </button>
      ) : null}
    </div>
  );
}

/**
 * Both halves, stacked, for a sheet that has nothing to put between them.
 */
export function AmountKeypad(
  props: AmountProps & React.ComponentProps<typeof AmountDisplay>,
) {
  const inputRef = React.useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-3">
      <AmountDisplay {...props} inputRef={inputRef} />
      <Keypad
        value={props.value}
        onChange={props.onChange}
        inputRef={inputRef}
      />
    </div>
  );
}
