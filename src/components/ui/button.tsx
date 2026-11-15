import * as React from "react";

import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import { Slot } from "radix-ui";

/*
 * Buttons, in the Phase 14 language.
 *
 * Press is `translate(2px, 2px)` over 80ms — the element moves into its own
 * hard shadow. That only reads as a press because the shadow has no blur: a
 * soft one would smear rather than meet it. Variants without a shadow still
 * take the move, so pressing feels the same everywhere.
 *
 * Focus is handled globally in globals.css as a 2px ink outline at 2px
 * offset, so nothing here restates it — the Phase 10 audit found three
 * controls that had quietly lost their own copy of it.
 */
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center text-sm font-semibold whitespace-nowrap select-none transition-[transform,background-color,border-color,color,box-shadow] duration-[80ms] ease-out motion-reduce:transition-none active:not-aria-[haspopup]:translate-x-[2px] active:not-aria-[haspopup]:translate-y-[2px] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        /*
         * The primary action: an ink pill that names its result.
         *
         * Full-radius rather than the 12px everything else uses. On a screen
         * of squared-off hairline cards the one pill is unmistakably the
         * thing to press, which is worth more than consistency of radius.
         */
        default: "bg-ink text-on-ink rounded-full",
        /** The bold variant of primary, for a dock or a tile. */
        accent: "bg-accent text-text accent-sm rounded-[15px]",
        secondary:
          "bg-surface text-text rounded-control border hoverable:bg-surface-muted",
        outline:
          "bg-surface text-text rounded-control border hoverable:bg-surface-muted",
        ghost:
          "text-text rounded-control border border-transparent hoverable:bg-surface-muted",
        /**
         * Destructive is expense-coloured text on a flat surface, never a
         * filled red button. A filled one reads as the primary action on a
         * screen where it is almost never what somebody came to do — and
         * every use of it is behind a confirmation anyway.
         */
        destructive:
          "bg-surface text-expense rounded-control border hoverable:bg-tint-rose",
        link: "text-text underline underline-offset-4",
      },
      size: {
        default: "h-9 gap-1.5 px-3",
        xs: "h-6 gap-1 rounded-[9px] px-2 text-xs [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1 rounded-[9px] px-2.5 text-[13px] [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-10 gap-2 px-4",
        icon: "size-9",
        "icon-xs": "size-6 rounded-[9px] [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8 rounded-[9px]",
        "icon-lg": "size-10",
        /*
         * Paisa: mobile tap targets must be >= 44x44px (CLAUDE.md), which
         * the sizes above are not. Use `touch` / `icon-touch` for anything a
         * thumb hits on a phone.
         */
        touch: "h-11 gap-2 px-4 text-sm",
        "icon-touch": "size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
