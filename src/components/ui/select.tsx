"use client";

import * as React from "react";

import { Check, ChevronDown } from "lucide-react";
import { Select as SelectPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

/**
 * A select that belongs to this app rather than to the operating system.
 *
 * The native control was doing two jobs: it held the value and the keyboard
 * semantics, and it drew the list. It is very good at the first and the
 * app has no say in the second, an iOS wheel, a Windows list, a grey
 * Android sheet, none of which know about the radii, the hairlines, the
 * raised surface or the 44px floor everything else here is built to.
 *
 * Radix keeps the semantics (a real listbox, typeahead, arrow keys, Escape,
 * focus return) and hands over the drawing, so the list opens as one of our
 * own surfaces with the selected row marked the way every selected thing in
 * this language is marked.
 */
export const Select = SelectPrimitive.Root;
export const SelectValue = SelectPrimitive.Value;

export const SelectTrigger = React.forwardRef<
  React.ComponentRef<typeof SelectPrimitive.Trigger>,
  React.ComponentProps<typeof SelectPrimitive.Trigger> & { chevron?: boolean }
>(function SelectTrigger(
  { className, children, chevron = true, asChild, ...props },
  ref,
) {
  // With `asChild` the caller is supplying the element to be the trigger,
  // a FieldCard, usually, and Radix slots its props onto it. Slot takes
  // exactly one child, so the span and the chevron this would otherwise
  // add are two children too many: pass the caller's element straight
  // through and let it draw itself.
  if (asChild) {
    return (
      <SelectPrimitive.Trigger ref={ref} asChild {...props}>
        {children}
      </SelectPrimitive.Trigger>
    );
  }

  return (
    <SelectPrimitive.Trigger
      ref={ref}
      className={cn(
        "bg-surface rounded-control flex h-11 w-full min-w-0 items-center",
        "justify-between gap-2 border px-3 text-left text-base md:text-sm",
        "pressable hoverable:bg-surface-muted",
        "data-[placeholder]:text-text-secondary",
        className,
      )}
      {...props}
    >
      <span className="min-w-0 truncate">{children}</span>
      {chevron ? (
        <SelectPrimitive.Icon asChild>
          <ChevronDown
            className="text-text-secondary size-4 shrink-0"
            aria-hidden="true"
          />
        </SelectPrimitive.Icon>
      ) : null}
    </SelectPrimitive.Trigger>
  );
});

export function SelectContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Content>) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        position="popper"
        sideOffset={6}
        className={cn(
          // `raised` is the third surface: what floats above the page and
          // above a card. In dark mode that is a lighter surface and a
          // brighter border, because a shadow on a near-black page is not
          // separation anybody can see.
          "raised rounded-card z-50 max-h-[min(24rem,var(--radix-select-content-available-height))]",
          "min-w-[var(--radix-select-trigger-width)] overflow-y-auto overscroll-contain border p-1",
          className,
        )}
        {...props}
      >
        <SelectPrimitive.Viewport>{children}</SelectPrimitive.Viewport>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
}

export function SelectItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item
      className={cn(
        // 44px, like every other thing a thumb is asked to hit.
        "rounded-control relative flex min-h-11 cursor-default items-center",
        "gap-2 py-2 pr-2 pl-9 text-sm outline-none select-none",
        "data-[highlighted]:bg-surface-muted data-[state=checked]:font-semibold",
        "data-[disabled]:opacity-50",
        className,
      )}
      {...props}
    >
      <span className="absolute left-3 flex size-4 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <Check className="size-4" aria-hidden="true" />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
}

export function SelectLabel({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Label>) {
  return (
    <SelectPrimitive.Label
      className={cn(
        "text-text-secondary px-3 pt-2 pb-1 text-xs font-semibold",
        className,
      )}
      {...props}
    />
  );
}
