import { z } from "zod";

import { CURRENCIES } from "@/lib/currencies";

const CURRENCY_CODES = CURRENCIES.map((currency) => currency.code);

/**
 * What onboarding collects.
 *
 * The opening balance stays a string all the way to the server, where
 * `toMinor` turns it into paise using the chosen currency's exponent — parsing
 * it here would mean guessing the exponent twice.
 */
export const onboardingSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, "Tell us what to call you.")
    .max(80, "That name is a bit long."),
  currencyCode: z
    .string()
    .trim()
    .toUpperCase()
    .refine((code) => CURRENCY_CODES.includes(code), "Pick a currency."),
  accountName: z
    .string()
    .trim()
    .min(1, "Give the account a name.")
    .max(60, "That name is a bit long."),
  openingBalance: z
    .string()
    .trim()
    .max(20, "That is a very large number."),
});

export type OnboardingInput = z.input<typeof onboardingSchema>;
