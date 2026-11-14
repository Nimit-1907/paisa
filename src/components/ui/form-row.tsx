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
  error,
  hint,
  className,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  className?: string;
  children: (props: {
    id: string;
    "aria-invalid": boolean;
    "aria-describedby": string | undefined;
  }) => React.ReactNode;
}) {
  const messageId = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id}>{label}</Label>

      {children({
        id,
        "aria-invalid": Boolean(error),
        "aria-describedby": messageId,
      })}

      {error ? (
        <p id={messageId} role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : hint ? (
        <p id={messageId} className="text-muted-foreground text-sm">
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
        className="text-muted-foreground hover:text-foreground focus-visible:ring-ring absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg transition-colors focus-visible:ring-2 focus-visible:outline-none"
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
