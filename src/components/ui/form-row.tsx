"use client";

import * as React from "react";

import { Eye, EyeOff } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * Label + control + message, wired for accessibility.
 *
 * The error is announced (`role="alert"`) and tied to the control through
 * aria-describedby, so a screen reader hears why the form bounced instead of
 * just that it did.
 */
export function FormRow({
  id,
  label,
  action,
  error,
  hint,
  required = false,
  className,
  children,
}: {
  id: string;
  label: string;
  /**
   * Mark the field as required.
   *
   * The asterisk is the mark, and only required fields carry one: labelling
   * the optional ones "Optional" instead meant the common case was the one
   * carrying the extra word, and a form where most rows say something under
   * them reads as a form with a lot to explain. Said in words as well as in
   * red, because an asterisk is a colour and a shape.
   */
  required?: boolean;
  /**
   * A link or button on the same line as the label.
   *
   * "Forgot password?" belongs here rather than under the field. Under it,
   * it sits between the password and the submit button, so the thing you
   * tab to after typing your password is the way out of the form.
   */
  action?: React.ReactNode;
  error?: string;
  hint?: string;
  className?: string;
  children: (props: {
    id: string;
    "aria-invalid": boolean;
    "aria-describedby": string | undefined;
    "aria-required": true | undefined;
  }) => React.ReactNode;
}) {
  const messageId = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  /*
   * The asterisk sits beside the label, not inside it.
   *
   * It is decoration: `aria-required` on the control is what a screen
   * reader announces, and it announces it on the field rather than as part
   * of its name. Inside the `<label>` the character would join the label's
   * text whether or not it is `aria-hidden`, renaming the field from
   * "Password" to "Password*" for anything that matches on label text,
   * which is what every test and every password manager does.
   */
  const labelled = (
    <span className="flex items-baseline gap-0.5">
      <Label htmlFor={id}>{label}</Label>
      {required ? (
        <span aria-hidden="true" className="text-expense">
          *
        </span>
      ) : null}
    </span>
  );

  return (
    <div className={cn("space-y-1.5", className)}>
      {action ? (
        <div className="flex items-baseline justify-between gap-3">
          {labelled}
          {action}
        </div>
      ) : (
        labelled
      )}

      {children({
        id,
        "aria-invalid": Boolean(error),
        "aria-describedby": messageId,
        "aria-required": required || undefined,
      })}

      {error ? (
        <p id={messageId} role="alert" className="text-expense text-sm">
          {error}
        </p>
      ) : hint ? (
        <p id={messageId} className="text-text-secondary text-sm">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Password field with a show/hide toggle.
 *
 * The toggle is a 44px target inside the field and is `tabIndex={-1}` so it
 * does not sit between the password and the submit button in the tab order.
 */
export function PasswordInput({
  className,
  ...props
}: React.ComponentProps<typeof Input>) {
  const [visible, setVisible] = React.useState(false);

  return (
    <div className="relative">
      <Input
        {...props}
        type={visible ? "text" : "password"}
        className={cn("pr-12", className)}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setVisible((current) => !current)}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        className="text-text-secondary hoverable:text-text absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg transition-colors  "
      >
        {visible ? (
          <EyeOff className="size-[18px]" aria-hidden="true" />
        ) : (
          <Eye className="size-[18px]" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}
