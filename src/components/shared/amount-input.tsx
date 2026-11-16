"use client";

import * as React from "react";

import { useCurrency } from "@/components/profile-provider";
import {
  AmountKeypad,
  useDockedKeypad,
  useKeepAboveKeypad,
  useTouchKeypad,
} from "@/components/shared/amount-keypad";
import { Input } from "@/components/ui/input";
import { cleanAmount } from "@/lib/amount";
import { cn } from "@/lib/utils";

/**
 * An amount in an ordinary form field: the opening balance, onboarding's
 * balances, the filters' Min and Max.
 *
 * Like every amount field it never raises the device keyboard
 * (`inputMode="none"`): on a touch screen the in-app pad docks up from the
 * bottom while it has focus and goes with Done, and a physical keyboard
 * types into it as usual. Spread `FormRow`'s field props onto it.
 */
export function AmountInput({
  value,
  onChange,
  allowNegative = false,
  showSymbol = true,
  className,
  ...props
}: Omit<React.ComponentProps<"input">, "value" | "onChange" | "inputMode"> & {
  value: string;
  onChange: (next: string) => void;
  /** An opening balance can be below zero; a filter bound cannot. */
  allowNegative?: boolean;
  /** The currency symbol inside the field, on the left. */
  showSymbol?: boolean;
}) {
  const currency = useCurrency();
  const touch = useTouchKeypad();
  const dock = useDockedKeypad();
  const ref = React.useRef<HTMLInputElement>(null);
  useKeepAboveKeypad(ref, touch && dock.open);

  return (
    <div {...dock.bind}>
      <div className="relative">
        {showSymbol ? (
          <span className="text-text-secondary pointer-events-none absolute inset-y-0 left-3 flex items-center text-base">
            {currency.symbol}
          </span>
        ) : null}
        <Input
          {...props}
          ref={ref}
          type="text"
          inputMode="none"
          autoComplete="off"
          value={value}
          onChange={(event) =>
            onChange(
              cleanAmount(event.target.value, currency.decimals, value, {
                allowNegative,
              }),
            )
          }
          className={cn("amount", showSymbol && "pl-9", className)}
        />
      </div>

      {touch && dock.open ? (
        <AmountKeypad
          variant="dock"
          value={value}
          onChange={onChange}
          decimals={currency.decimals}
          allowNegative={allowNegative}
          onDone={() => ref.current?.blur()}
        />
      ) : null}
    </div>
  );
}
