"use client";

import * as React from "react";

import {
  type CurrencySettings,
  DEFAULT_CURRENCY_SETTINGS,
  type FormatMoneyOptions,
  formatWith,
} from "@/lib/money";

const CurrencyContext = React.createContext<CurrencySettings>(
  DEFAULT_CURRENCY_SETTINGS,
);

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
  children,
}: {
  currency: CurrencySettings;
  children: React.ReactNode;
}) {
  return (
    <CurrencyContext.Provider value={currency}>
      {children}
    </CurrencyContext.Provider>
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
