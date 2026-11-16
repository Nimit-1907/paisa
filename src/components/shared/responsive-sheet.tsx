"use client";

import * as React from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { StickyActionBar } from "@/components/shared/sticky-action-bar";
import { useIsDesktop } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";

/**
 * A bottom sheet on phones, a centred dialog from `lg` up (CLAUDE.md).
 *
 * The media query returns false on the server and on the first client render,
 * so the mobile branch is what gets rendered first, mobile-first in the
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

        And higher again on a short phone. 64px of backdrop plus an 8% cap
        is 115px on a 667px screen, an iPhone SE, which the add sheet does
        not have to give: measured there, the category grid, which is step
        three of a four-tap flow, had no row fully on screen at all. A phone
        tall enough for the grid keeps the roomier framing; one that is not
        spends its pixels on the thing being chosen rather than on the
        dimmed page behind it.
      */}
      <DrawerContent
        className={cn(
          "data-[vaul-drawer-direction=bottom]:mt-16 data-[vaul-drawer-direction=bottom]:max-h-[92dvh]",
          "[@media(max-height:780px)]:data-[vaul-drawer-direction=bottom]:mt-4",
          "[@media(max-height:780px)]:data-[vaul-drawer-direction=bottom]:max-h-[97dvh]",
          className,
        )}
      >
        {/*
          Title left, close right.

          A centred title with no visible close is the shadcn default and
          the thing first-time users asked about in the Phase 13 session:
          swiping a sheet down is not obvious on a phone and is not possible
          at all with a keyboard on desktop. The × is the third way out,
          beside the swipe and the backdrop.
        */}
        <DrawerHeader className="flex-row items-start justify-between gap-2 pb-2">
          <div className="min-w-0 text-left">
            <DrawerTitle>{title}</DrawerTitle>
            {description ? (
              <DrawerDescription>{description}</DrawerDescription>
            ) : (
              // Radix warns when a dialog has no description; an empty one
              // that is hidden from everyone keeps the console clean without
              // making a screen reader read filler.
              <DrawerDescription className="sr-only">{title}</DrawerDescription>
            )}
          </div>

          <DrawerClose asChild>
            <Button
              variant="secondary"
              size="icon-touch"
              aria-label="Close"
              className="-mt-1.5 -mr-2 shrink-0"
            >
              <X className="size-4" aria-hidden="true" />
            </Button>
          </DrawerClose>
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
 * so the dialog has nothing to hand focus back to and drops it on the body,
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
  fill = false,
  className,
  children,
}: {
  /**
   * Take whatever height is left rather than a share of the window.
   *
   * For a sheet with something fixed below the scrolling part, the add
   * sheet's keypad. A measured `max-h` cannot know how tall that is, and
   * guessing is how the keypad ended up half off the bottom of a 390×844
   * phone; `flex-1` with `min-h-0` asks the flex column instead, which
   * does know, and the desktop dialog is the same flex column, so the
   * keypad and the save button stay put there too.
   */
  fill?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "space-y-4 overflow-y-auto overscroll-contain px-4 pb-2 lg:px-0",
        fill
          ? "min-h-0 flex-1"
          : // 70dvh rather than 65: on a 640px phone those five percent are
            // the difference between the category grid being on screen and
            // being a scroll away, and the header and footer still fit
            // above and below.
            "max-h-[70dvh]",
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * The part of a sheet that does not scroll, directly under the title.
 *
 * The add sheet's type tabs and its amount: the two things that must stay
 * on screen while the categories below them are scrolled, because they are
 * what the keypad at the bottom is editing.
 */
export function SheetHead({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("shrink-0 space-y-2 px-4 pb-2 lg:px-0", className)}>
      {children}
    </div>
  );
}

/**
 * The save area of a sheet.
 *
 * A thin naming layer over {@link StickyActionBar}, the keyboard handling
 * and the surface live there now, so the sheet and the page cannot drift
 * apart.
 */
export function SheetFooter({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <StickyActionBar variant="sheet" className={className}>
      {children}
    </StickyActionBar>
  );
}
