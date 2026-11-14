"use client";

import * as React from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { useIsDesktop } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";

/**
 * A bottom sheet on phones, a centred dialog from `lg` up (CLAUDE.md).
 *
 * The media query returns false on the server and on the first client render,
 * so the mobile branch is what gets rendered first — mobile-first in the
 * literal sense.
 */
export function ResponsiveSheet({
  open,
  onOpenChange,
  title,
  description,
  className,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const isDesktop = useIsDesktop();
  useFocusReturn(open);

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className={cn("sm:max-w-md", className)}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description ? (
              <DialogDescription>{description}</DialogDescription>
            ) : null}
          </DialogHeader>
          {children}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange} repositionInputs={false}>
      {/*
        Taller than the shadcn default, and starting higher.
        96px of dimmed backdrop above a sheet is 15% of a 640px phone spent
        on nothing, and it was the difference between the category row being
        on screen while the amount is typed and being a scroll away.
      */}
      <DrawerContent
        className={cn(
          "data-[vaul-drawer-direction=bottom]:mt-16 data-[vaul-drawer-direction=bottom]:max-h-[92dvh]",
          className,
        )}
      >
        <DrawerHeader className="text-left">
          <DrawerTitle>{title}</DrawerTitle>
          {description ? (
            <DrawerDescription>{description}</DrawerDescription>
          ) : (
            // Radix warns when a dialog has no description; an empty one that
            // is hidden from everyone keeps the console clean without making
            // a screen reader read filler.
            <DrawerDescription className="sr-only">{title}</DrawerDescription>
          )}
        </DrawerHeader>
        {children}
      </DrawerContent>
    </Drawer>
  );
}

/**
 * Put focus back where it came from when a sheet closes.
 *
 * These sheets are opened from a context rather than from a trigger element,
 * so the dialog has nothing to hand focus back to and drops it on the body —
 * which sends a keyboard user back to the top of the page every time they
 * close one. Remembering what was focused is the only thing that can know.
 */
function useFocusReturn(open: boolean) {
  const previous = React.useRef<HTMLElement | null>(null);

  React.useEffect(() => {
    if (open) {
      previous.current = document.activeElement as HTMLElement | null;
      return;
    }

    const target = previous.current;
    previous.current = null;

    // Not if it has gone: deleting a record closes the sheet and takes the
    // row's own buttons with it.
    if (!target || !target.isConnected) return;

    // After the dialog has finished unmounting and released focus itself.
    const id = window.setTimeout(
      () => target.focus({ preventScroll: true }),
      0,
    );
    return () => window.clearTimeout(id);
  }, [open]);
}

/**
 * Scrollable body for a sheet, with the footer kept clear of the home bar.
 *
 * 65dvh rather than vh: mobile browser chrome moves, and a sheet that is
 * taller than the visible area hides its own save button.
 */
export function SheetBody({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        // 70dvh rather than 65: on a 640px phone those five percent are the
        // difference between the category grid being on screen and being a
        // scroll away, and the header and footer still fit above and below.
        "max-h-[70dvh] space-y-4 overflow-y-auto overscroll-contain px-4 pb-2 lg:px-0",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function SheetFooter({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "pb-safe flex gap-2 px-4 pt-4 pb-4 lg:px-0 lg:pb-0",
        className,
      )}
    >
      {children}
    </div>
  );
}
