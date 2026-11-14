"use client";

import * as React from "react";

import { haptic } from "@/lib/motion";
import {
  type CurrencySettings,
  DEFAULT_CURRENCY_SETTINGS,
  type FormatMoneyOptions,
  formatWith,
} from "@/lib/money";

const CurrencyContext = React.createContext<CurrencySettings>(
  DEFAULT_CURRENCY_SETTINGS,
);

/** Whether this person wants the phone to buzz when something is saved. */
const HapticsContext = React.createContext(true);

/**
 * Carries the signed-in user's currency down to Client Components.
 *
 * Only the currency: everything here travels in the RSC payload on every
 * page, so the name and email stay on the server until something client-side
 * genuinely needs them. The (app) layout has the profile loaded already, so
 * the alternative is every amount on screen either firing its own query or
 * quietly rendering in rupees for someone who picked dollars.
 */
export function ProfileProvider({
  currency,
  haptics,
  children,
}: {
  currency: CurrencySettings;
  haptics: boolean;
  children: React.ReactNode;
}) {
  return (
    <CurrencyContext.Provider value={currency}>
      <HapticsContext.Provider value={haptics}>
        {children}
      </HapticsContext.Provider>
    </CurrencyContext.Provider>
  );
}

/**
 * A light tap, for the two actions that change data.
 *
 * Returns a function rather than a boolean so the caller never has to
 * remember the check: `tap()` does nothing when the setting is off, and
 * nothing again on hardware that cannot vibrate.
 */
export function useHaptic() {
  const enabled = React.useContext(HapticsContext);

  return React.useCallback(
    (pattern?: number | number[]) => haptic(enabled, pattern),
    [enabled],
  );
}

export function useCurrency(): CurrencySettings {
  return React.useContext(CurrencyContext);
}

/**
 * `formatMoney` bound to the signed-in user's currency.
 *
 * const format = useFormatMoney();
 * format(12345678n)                      → "₹1,23,456.78"
 * format(-50000n, { signDisplay: "never" }) → "₹500.00"
 */
export function useFormatMoney() {
  const currency = useCurrency();

  return React.useCallback(
    (
      minor: bigint,
      options?: Omit<FormatMoneyOptions, "symbol" | "decimals">,
    ) => formatWith(currency, minor, options),
    [currency],
  );
}
