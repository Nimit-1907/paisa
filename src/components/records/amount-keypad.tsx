"use client";

import * as React from "react";

import { Delete, Equal } from "lucide-react";

import { useCurrency, useFormatMoney } from "@/components/profile-provider";
import { evaluate, isExpression, pressKey } from "@/lib/calculator";
import { cn } from "@/lib/utils";

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
  autoFocus = false,
}: {
  /** The raw expression, e.g. "120+45". */
  value: string;
  onChange: (next: string) => void;
  tone: "expense" | "income" | "transfer";
  autoFocus?: boolean;
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
      <div
        className="bg-muted/50 rounded-2xl px-4 py-3 text-right"
        onClick={() => inputRef.current?.focus()}
      >
        <input
          ref={inputRef}
          // Not a number input: it has to hold "120+45" as well as "165".
          type="text"
          inputMode="decimal"
          autoComplete="off"
          autoFocus={autoFocus}
          aria-label="Amount"
          value={value}
          onChange={(event) =>
            // Only the characters the keypad itself can produce.
            onChange(event.target.value.replace(/[^\d.+\-×÷*/]/g, ""))
          }
          className="sr-only"
        />

        <p
          aria-hidden="true"
          className={cn(
            "amount truncate text-3xl font-semibold tabular-nums",
            value ? toneClass : "text-muted-foreground",
          )}
        >
          {value ? `${currency.symbol}${value}` : `${currency.symbol}0`}
        </p>

        <p
          aria-live="polite"
          className={cn(
            "mt-0.5 h-5 text-sm",
            result.ok ? "text-muted-foreground" : "text-destructive",
          )}
        >
          {!result.ok
            ? result.error
            : showsSum
              ? `= ${formatMoney(result.minor)}`
              : " "}
        </p>
      </div>

      <div className="grid grid-cols-4 gap-1.5">
        {KEYS.flat().map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => press(key)}
            aria-label={key === "backspace" ? "Backspace" : key}
            className={cn(
              "focus-visible:ring-ring flex h-12 items-center justify-center rounded-xl text-lg font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none active:scale-[0.98]",
              /[\d.]/.test(key)
                ? "bg-muted hover:bg-muted/70"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/70",
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
            // Replace the sum with its answer, the way a calculator does.
            const whole = result.minor / 10n ** BigInt(currency.decimals);
            const fraction = (
              result.minor % 10n ** BigInt(currency.decimals)
            ).toString().padStart(currency.decimals, "0");
            onChange(
              currency.decimals === 0
                ? whole.toString()
                : `${whole}.${fraction}`,
            );
          }}
          disabled={!result.ok}
          className="bg-secondary text-secondary-foreground hover:bg-secondary/70 focus-visible:ring-ring flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
        >
          <Equal className="size-4" aria-hidden="true" />
          Work it out
        </button>
      ) : null}
    </div>
  );
}
