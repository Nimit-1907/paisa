"use client";

import * as React from "react";

import { Dialog as DialogPrimitive } from "radix-ui";

import { useFocusReturn } from "@/components/shared/responsive-sheet";
import { cn } from "@/lib/utils";

/**
 * A form that takes the whole screen on a phone, and is a centred dialog
 * from `lg` up.
 *
 * For Add Record, whose keypad is always on screen: a bottom sheet with a
 * drag handle and a backdrop strip above it spent height the keypad, the
 * pickers and the note all needed, and a drag-to-dismiss gesture over a
 * keypad is one slipped thumb from throwing a record away. Leaving is the
 * header's Cancel, Escape, or (on desktop) the backdrop.
 *
 * The caller draws its own header row (Cancel and Save), so the title is
 * for assistive technology only.
 */
export function FullScreenSheet({
  open,
  onOpenChange,
  title,
  description,
  initialFocus,
  className,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  /** Where focus goes on open; the dialog itself by default. */
  initialFocus?: React.RefObject<HTMLElement | null>;
  className?: string;
  children: React.ReactNode;
}) {
  useFocusReturn(open);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          data-slot="dialog-overlay"
          className="data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0 fixed inset-0 z-50 hidden bg-black/40 duration-100 lg:block"
        />
        <DialogPrimitive.Content
          data-slot="dialog-content"
          onOpenAutoFocus={(event) => {
            if (!initialFocus?.current) return;
            event.preventDefault();
            initialFocus.current.focus({ preventScroll: true });
          }}
          className={cn(
            "bg-background text-text fixed inset-0 z-50 flex h-dvh flex-col outline-none",
            "pt-[max(0.25rem,env(safe-area-inset-top))] pb-[max(0.5rem,env(safe-area-inset-bottom))]",
            "data-open:animate-in data-open:fade-in-0 data-open:slide-in-from-bottom-6 data-closed:animate-out data-closed:fade-out-0 duration-150 motion-reduce:animate-none",
            // Desktop: the same content in a dialog sized for it.
            "lg:rounded-dialog lg:inset-auto lg:top-1/2 lg:left-1/2 lg:h-[min(820px,92dvh)] lg:w-full lg:max-w-md lg:-translate-x-1/2 lg:-translate-y-1/2 lg:border lg:py-2",
            className,
          )}
        >
          <DialogPrimitive.Title className="sr-only">
            {title}
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            {description ?? title}
          </DialogPrimitive.Description>
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
