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
      <DrawerContent className={className}>
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
        "max-h-[65dvh] space-y-5 overflow-y-auto overscroll-contain px-4 pb-2 lg:px-0",
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
