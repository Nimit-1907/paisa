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

/** Whether lists should draw ".00". Off by default; see the migration. */
const ShowPaiseContext = React.createContext(false);
const DisplayNameContext = React.createContext("");
const TimeZoneContext = React.createContext("Asia/Kolkata");
/** 0 = Sunday, 1 = Monday: the first column of every calendar. */
const WeekStartContext = React.createContext(1);

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
  showPaise,
  displayName,
  timeZone,
  weekStart = 1,
  children,
}: {
  currency: CurrencySettings;
  haptics: boolean;
  showPaise: boolean;
  /** For the header's profile avatar, which is on every screen. */
  displayName: string;
  /** The profile's time zone, for anything on the client that asks "today". */
  timeZone: string;
  /** From the profile; every calendar starts its week here. */
  weekStart?: number;
  children: React.ReactNode;
}) {
  return (
    <CurrencyContext.Provider value={currency}>
      <HapticsContext.Provider value={haptics}>
        <ShowPaiseContext.Provider value={showPaise}>
          <DisplayNameContext.Provider value={displayName}>
            <TimeZoneContext.Provider value={timeZone}>
              <WeekStartContext.Provider value={weekStart}>
                {children}
              </WeekStartContext.Provider>
            </TimeZoneContext.Provider>
          </DisplayNameContext.Provider>
        </ShowPaiseContext.Provider>
      </HapticsContext.Provider>
    </CurrencyContext.Provider>
  );
}

/** The profile's time zone. */
export function useTimeZone(): string {
  return React.useContext(TimeZoneContext);
}

/** The day every calendar's week starts on: 0 Sunday, 1 Monday. */
export function useWeekStart(): number {
  return React.useContext(WeekStartContext);
}

/** The signed-in user's display name, or "" if they have not set one. */
export function useDisplayName(): string {
  return React.useContext(DisplayNameContext);
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
 * Whether this person asked to see ".00".
 *
 * Read by `Amount`, which is the only thing that should be consulting it,
 * a screen that checks this itself is a screen that will forget to.
 */
export function useShowPaise(): boolean {
  return React.useContext(ShowPaiseContext);
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
