import * as React from "react";
import { cn } from "cn";

/**
 * A text field, in the Phase 14 language.
 *
 * Surface fill, hairline border, 12px radius; on focus the border becomes
 * ink, on top of the app-wide 2px focus outline from globals.css. Errors are
 * not drawn here, they are expense-coloured text under the field, which is
 * what `FormRow` renders, so nothing in this file needs a red ring.
 *
 * What this replaced had three dead classes in it: a `ring-3` with no ring
 * colour, a stray `/50` left over from a split opacity modifier, and
 * `dark:bg-foreground/5`, a tint that is not one of the eight.
 */
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        // 44px and 16px at every width. "Compact from md up" made every
        // field on an iPad, a touch screen, 36px tall and 14px, which iOS
        // zooms the page into on focus.
        "bg-surface rounded-control h-11 w-full min-w-0 border px-3 py-1 text-base",
        "placeholder:text-text-secondary transition-colors focus-visible:border-ink",
        "file:text-text file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-semibold",
        "disabled:bg-surface-muted disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        "aria-invalid:border-expense",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
