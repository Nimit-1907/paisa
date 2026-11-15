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

/**
 * The amount field and its keypad.
 *
 * A keypad rather than a number input, because the arithmetic is the point:
 * people log "120+45" when they split a bill, and making them do that sum in
 * their head is how an amount ends up wrong. The expression is shown as typed
 * with the running total underneath, so there is never a question about what
 * will be saved.
 *
 * There is a hidden input behind it so a physical keyboard still works on
 * desktop, where tapping a 4×4 grid would be the slower way.
 */
export function AmountKeypad({
  value,
  onChange,
  tone,
  focusOnOpen = false,
  invalid = false,
  error,
  shaking = false,
  onEnter,
}: {
  /** The raw expression, e.g. "120+45". */
  value: string;
  onChange: (next: string) => void;
  tone: "expense" | "income" | "transfer";
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
}) {
  const currency = useCurrency();
  const formatMoney = useFormatMoney();
  const inputRef = React.useRef<HTMLInputElement>(null);

  const result = evaluate(value || "0", currency.decimals);
  const showsSum = isExpression(value);

  const press = (key: string) => {
    onChange(pressKey(value, key));
    inputRef.current?.focus();
  };

  const toneClass =
    tone === "income"
      ? "text-income"
      : tone === "transfer"
        ? "text-transfer"
        : "text-expense";

  return (
    <div className="space-y-3">
      {/*
        The amount is the screen, not a field on it.

        Phase 14 takes it out of its grey box and sets it centred in the
        display face at 48px, with the sign in the money colour. There is
        nothing else above the keypad, so a box drawn around it was dividing
        one thing from nothing.
      */}
      <label
        htmlFor="amount-field"
        className={cn(
          "block px-2 py-2 text-center",
          // The outline is the message under reduced motion, where the shake
          // never fires; with motion on, both happen.
          invalid && "rounded-card ring-expense ring-2",
          shaking && "shake",
        )}
      >
        <input
          id="amount-field"
          ref={inputRef}
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
          className="sr-only"
        />

        <p
          aria-hidden="true"
          className={cn(
            "font-display amount-hero truncate text-[48px] leading-none tracking-[-0.03em] tabular-nums",
            value ? toneClass : "text-text-secondary",
          )}
        >
          <span className="amount-unit">
            {tone === "income" ? "+" : tone === "expense" ? "−" : ""}
            {currency.symbol}
          </span>
          {value || "0"}
        </p>

        <p
          aria-live="polite"
          className={cn(
            "mt-0.5 h-5 text-sm",
            result.ok && !invalid ? "text-text-secondary" : "text-expense",
          )}
        >
          {error
            ? error
            : !result.ok
              ? result.error
              : showsSum
                ? `= ${formatMoney(result.minor)}`
                : " "}
        </p>
      </label>

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
          className="bg-surface-muted text-text hoverable:bg-surface-muted/70 flex h-11 w-full items-center justify-center gap-2 rounded-control text-sm font-semibold transition-colors   disabled:opacity-50"
        >
          <Equal className="size-4" aria-hidden="true" />
          Work it out
        </button>
      ) : null}
    </div>
  );
}
