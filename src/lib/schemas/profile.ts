import { z } from "zod";

import { CURRENCIES } from "@/lib/currencies";

const CURRENCY_CODES = CURRENCIES.map((currency) => currency.code);

/**
 * What onboarding collects.
 *
 * The opening balance stays a string all the way to the server, where
 * `toMinor` turns it into paise using the chosen currency's exponent, parsing
 * it here would mean guessing the exponent twice.
 */
export const onboardingSchema = z
  .object({
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
    openingBalance: z.string().trim().max(20, "That is a very large number."),
    /**
     * An optional second account, for people who keep cash and a bank.
     *
     * Empty means "no thanks" rather than "an account with no name": most
     * people finish setup with one account, and asking them to decline a
     * second one would be a step that exists to be skipped.
     */
    bankName: z
      .string()
      .trim()
      .max(60, "That name is a bit long.")
      .optional()
      .transform((value) => (value ? value : undefined)),
    bankBalance: z
      .string()
      .trim()
      .max(20, "That is a very large number.")
      .optional(),
  })
  /**
   * Two accounts, two names.
   *
   * Refused rather than resolved quietly, because every quiet resolution is
   * wrong in some way: matching on the name later would find the first
   * account and overwrite its opening balance with the bank's, and renaming
   * one of them would hand somebody an account they did not ask for.
   */
  .refine(
    (values) =>
      !values.bankName ||
      values.bankName.toLowerCase() !== values.accountName.toLowerCase(),
    {
      path: ["bankName"],
      message: "Give the second account a different name.",
    },
  )
  /**
   * A balance with nothing to put it in.
   *
   * An empty name means "no second account", so a balance typed above an
   * empty name would be dropped on the floor and setup would finish as
   * though nothing had been asked for. Say so instead: the person opened
   * that panel on purpose.
   */
  .refine((values) => !values.bankBalance?.trim() || Boolean(values.bankName), {
    path: ["bankName"],
    message: "Name the second account, or clear the balance.",
  });

export type OnboardingInput = z.input<typeof onboardingSchema>;

/**
 * What Settings can change.
 *
 * Currency and decimals travel together: the exponent decides what every
 * stored amount *means*, so changing the symbol without the exponent would
 * silently re-price the whole history.
 */
export const updateProfileSchema = z.object({
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
  /**
   * 0 = Sunday … 6 = Saturday, matching date-fns and profiles.week_start.
   *
   * Not coerced: `z.coerce.number()` turns null and "" into 0, which would
   * silently save Sunday for a field the user never touched.
   */
  weekStart: z.number().int().min(0).max(6),
  theme: z.enum(["light", "dark", "system"]),
});

export type UpdateProfileInput = z.input<typeof updateProfileSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password."),
    newPassword: z
      .string()
      .min(8, "Use at least 8 characters.")
      // bcrypt truncates at 72 *bytes*, so a limit counted in characters
      // would let a password through that is silently cut short, and the
      // part past the cut would not be part of the password at all.
      .refine(
        (value) => new TextEncoder().encode(value).length <= 72,
        "That password is too long.",
      ),
    confirmPassword: z.string().min(1, "Repeat the new password."),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Those passwords do not match.",
  })
  .refine((value) => value.newPassword !== value.currentPassword, {
    path: ["newPassword"],
    message: "That is the password you already have.",
  });

export type ChangePasswordInput = z.input<typeof changePasswordSchema>;

/** The word someone has to type before their records are deleted. */
export const DELETE_CONFIRMATION = "DELETE";

export const deleteAccountSchema = z.object({
  confirm: z
    .string()
    .trim()
    .refine(
      (value) => value === DELETE_CONFIRMATION,
      `Type ${DELETE_CONFIRMATION} to confirm.`,
    ),
});
