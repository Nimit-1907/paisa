import { z } from "zod";

/**
 * Schemas shared by the forms and the Server Actions.
 *
 * They live outside `src/actions/auth.ts` because a "use server" module may
 * only export async functions, and because the browser should reject an empty
 * password before spending a round trip on it. The action re-validates: the
 * client-side check is a courtesy, never the gate.
 */

export const passwordSchema = z
  .string()
  .min(8, "Use at least 8 characters.")
  .max(72, "Passwords are limited to 72 characters.");

export const emailSchema = z
  .string()
  .trim()
  .min(1, "Enter your email address.")
  .email("That does not look like an email address.")
  .transform((value) => value.toLowerCase());

export const signUpSchema = z.object({
  displayName: z
    .string()
    .trim()
    .max(80, "That name is a bit long.")
    .optional()
    .transform((value) => (value ? value : undefined)),
  email: emailSchema,
  password: passwordSchema,
});

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password."),
  next: z.string().optional(),
});

export const resetRequestSchema = z.object({ email: emailSchema });

export const updatePasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Both passwords must match.",
    path: ["confirmPassword"],
  });

export type SignUpInput = z.input<typeof signUpSchema>;
export type SignInInput = z.input<typeof signInSchema>;
export type ResetRequestInput = z.input<typeof resetRequestSchema>;
export type UpdatePasswordInput = z.input<typeof updatePasswordSchema>;
