"use client";

import * as React from "react";

import { Delete } from "lucide-react";

import { useCurrency } from "@/components/profile-provider";
import {
  AmountKeypad,
  useDockedKeypad,
  useKeepAboveKeypad,
  useTouchKeypad,
} from "@/components/shared/amount-keypad";
import {
  amountKeyFor,
  cleanAmount,
  groupAmountText,
  parseAmount,
  pressKey,
} from "@/lib/amount";
import { usesIndianGrouping } from "@/lib/money";
import { cn } from "@/lib/utils";

type AmountProps = {
  /** What is typed, digits and one point: "450" or "450.50". */
  value: string;
  onChange: (next: string) => void;
  /**
   * Which sign and colour the symbol takes.
   *
   * `neutral` is for an amount that is not a movement of money, a budget
   * limit, a starting balance. Those have no direction, and a minus sign in
   * front of a budget says the opposite of what a budget is.
   */
  tone: "expense" | "income" | "transfer" | "neutral";
};

/**
 * The amount, as the headline of the form.
 *
 * The field itself is visually hidden behind the figure, and the figure is
 * its label, so a tap anywhere on it puts the caret in the field. It never
 * raises the device keyboard (`inputMode="none"`): amounts are entered on
 * the in-app keypad (shared/amount-keypad.tsx), and a physical keyboard
 * still types into the field.
 *
 * Two layouts:
 * - `hero`: centred in the display face at 48px, for the Recurring and
 *   Budget sheets, with the pad docking up from the bottom while the field
 *   has focus.
 * - `box`: right-aligned in a bordered box with ⌫ beside it, for Add
 *   Record, which draws its own always-visible pad underneath
 *   (`keypad="none"`).
 *
 * It takes an amount and nothing else: digits and one point, never a sum.
 */
export function AmountDisplay({
  value,
  onChange,
  tone,
  layout = "hero",
  keypad = "dock",
  focusOnOpen = false,
  invalid = false,
  error,
  shaking = false,
  onEnter,
  inputRef,
  replaceNext = false,
}: AmountProps & {
  layout?: "hero" | "box";
  /** `dock`: a pad slides up while focused (touch only). `none`: the caller draws one. */
  keypad?: "dock" | "none";
  /** Put the caret in the amount when the sheet opens. */
  focusOnOpen?: boolean;
  /** The save was refused because of this field. */
  invalid?: boolean;
  /** Why it was refused, in words. */
  error?: string;
  /** One short shake, already filtered for reduced motion by the caller. */
  shaking?: boolean;
  /** Enter on a physical keyboard: save, the way a form would. */
  onEnter?: () => void;
  /** Lets a parent put the caret back after it changes the value. */
  inputRef?: React.RefObject<HTMLInputElement | null>;
  /**
   * The amount was filled in for the person (a quick-add chip): it is drawn
   * as selected, and the next key replaces it rather than adding to it.
   */
  replaceNext?: boolean;
}) {
  const currency = useCurrency();
  const ownRef = React.useRef<HTMLInputElement>(null);
  const ref = inputRef ?? ownRef;
  const touch = useTouchKeypad();
  const dock = useDockedKeypad();
  useKeepAboveKeypad(ref, keypad === "dock" && touch && dock.open);

  // A lone point is an amount being typed, not a wrong one.
  const result =
    value && value !== "." ? parseAmount(value, currency.decimals) : null;

  const toneClass =
    tone === "income"
      ? "text-income"
      : tone === "transfer"
        ? "text-transfer"
        : tone === "neutral"
          ? "text-text-secondary"
          : "text-expense";

  const message = error ?? (result && !result.ok ? result.error : null);
  const messageId = "amount-field-message";

  const input = (
    <input
      id="amount-field"
      ref={ref}
      type="text"
      // No device keyboard: the in-app pad is the keypad. A physical
      // keyboard still types here.
      inputMode="none"
      autoComplete="off"
      // eslint-disable-next-line jsx-a11y/no-autofocus -- the sheet has just been opened, and the amount is what it was opened to take.
      autoFocus={focusOnOpen}
      aria-label="Amount"
      aria-invalid={invalid || undefined}
      aria-describedby={message ? messageId : undefined}
      value={value}
      onChange={(event) =>
        onChange(cleanAmount(event.target.value, currency.decimals, value))
      }
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          // The sheet is not a form, so Enter would otherwise do nothing on
          // the one screen a desktop user types the most into.
          event.preventDefault();
          onEnter?.();
          return;
        }

        if (event.ctrlKey || event.metaKey || event.altKey) return;

        // Digits, the point and the delete keys go through the keypad's
        // own rules rather than the browser's: the caret in a field nobody
        // can see sits wherever a tap left it, and a 7 typed in front of
        // "250" would book 7,250. Paste still arrives through onChange.
        const key = amountKeyFor(event.key);
        if (!key) return;
        event.preventDefault();
        onChange(
          pressKey(value, key, currency.decimals, { replace: replaceNext }),
        );
      }}
      className="peer sr-only"
    />
  );

  const figure = (
    <p
      aria-hidden="true"
      className={cn(
        "font-display text-text truncate leading-none tracking-[-0.03em] tabular-nums",
        layout === "hero"
          ? "text-[48px]"
          : "text-[40px] [@media(max-height:700px)]:text-[32px]",
        // A caret, because this is a text field with no box around it and
        // nothing else would say so. Steady rather than blinking.
        "after:bg-ink after:ml-1 after:inline-block after:h-[0.78em] after:w-[3px] after:translate-y-[0.06em] after:opacity-0 peer-focus:after:opacity-100",
        !value && "text-text-secondary",
      )}
    >
      <span className={cn("amount-unit", value && toneClass)}>
        {tone === "income" ? "+" : tone === "expense" ? "−" : ""}
        {currency.symbol}
      </span>
      <span
        className={cn(
          // Drawn as selected text is: the next key types over it.
          replaceNext && value && "bg-tint-sky rounded-segment px-1",
        )}
      >
        {value
          ? groupAmountText(value, usesIndianGrouping(currency.symbol))
          : "0"}
      </span>
    </p>
  );

  const messageLine = (
    <p
      id={messageId}
      aria-live="polite"
      className={cn(
        "text-expense h-4 text-xs",
        layout === "hero" ? "mt-1 text-center" : "mt-1 px-1",
      )}
    >
      {message ?? " "}
    </p>
  );

  if (layout === "box") {
    return (
      <div className={cn(shaking && "shake")}>
        <div
          className={cn(
            // The screen's one accent: the amount is what it is for.
            "bg-surface accent-lg rounded-card flex items-center gap-2 py-2 pr-1 pl-4 [@media(max-height:700px)]:py-1",
            invalid && "ring-expense ring-2",
          )}
        >
          <label htmlFor="amount-field" className="min-w-0 flex-1 text-right">
            {input}
            {figure}
          </label>
          <button
            type="button"
            aria-label="Delete last digit"
            onPointerDown={(event) => event.preventDefault()}
            onClick={() =>
              onChange(
                pressKey(value, "back", currency.decimals, {
                  replace: replaceNext,
                }),
              )
            }
            disabled={!value}
            className="text-text-secondary hoverable:bg-surface-muted rounded-control flex size-11 shrink-0 items-center justify-center disabled:opacity-40"
          >
            <Delete className="size-5" aria-hidden="true" />
          </button>
        </div>
        {/* Only when there is something to say: on this screen a reserved
            empty line is 20px the keypad needs. */}
        {message ? messageLine : null}
      </div>
    );
  }

  return (
    <div {...(keypad === "dock" ? dock.bind : {})}>
      <label
        htmlFor="amount-field"
        className={cn(
          "block px-2 text-center",
          // The outline is the message under reduced motion, where the
          // shake never fires; with motion on, both happen.
          invalid && "rounded-card ring-expense ring-2",
          shaking && "shake",
        )}
      >
        {input}
        {figure}
        {messageLine}
      </label>

      {keypad === "dock" && touch && dock.open ? (
        <AmountKeypad
          variant="dock"
          value={value}
          onChange={onChange}
          decimals={currency.decimals}
          onDone={() => ref.current?.blur()}
        />
      ) : null}
    </div>
  );
}
