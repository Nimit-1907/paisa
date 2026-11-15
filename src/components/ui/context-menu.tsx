"use client";

import * as React from "react";

import { ContextMenu as ContextMenuPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

/**
 * Right-click on a desktop, long-press on a phone.
 *
 * Radix's context menu already carries both — it opens on `contextmenu` for a
 * mouse and on a held touch — which is why Phase 13's "long-press for a
 * context menu" and "right-click context menu" are one component rather than
 * two gestures wired by hand.
 *
 * It is never the only way to reach anything. Every item in one of these is
 * also a visible control somewhere: a shortcut for people who know it exists,
 * and nothing lost for people who do not.
 */
function ContextMenu({
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.Root>) {
  return <ContextMenuPrimitive.Root data-slot="context-menu" {...props} />;
}

function ContextMenuTrigger({
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.Trigger>) {
  return (
    <ContextMenuPrimitive.Trigger data-slot="context-menu-trigger" {...props} />
  );
}

function ContextMenuContent({
  className,
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.Content>) {
  return (
    <ContextMenuPrimitive.Portal>
      <ContextMenuPrimitive.Content
        data-slot="context-menu-content"
        className={cn(
          "raised rounded-control z-50 min-w-44 overflow-hidden border p-1",
          "data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95",
          "data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          "duration-[120ms]",
          className,
        )}
        {...props}
      />
    </ContextMenuPrimitive.Portal>
  );
}

function ContextMenuItem({
  className,
  tone = "default",
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.Item> & {
  tone?: "default" | "destructive";
}) {
  return (
    <ContextMenuPrimitive.Item
      data-slot="context-menu-item"
      className={cn(
        // 44px tall: a menu item is a tap target like any other, and a
        // long-press menu is reached by thumb more often than by mouse.
        "rounded-control relative flex min-h-11 cursor-default items-center gap-2.5 px-3 text-sm font-medium outline-none select-none",
        "data-highlighted:bg-surface-muted data-highlighted:text-text",
        "[&_svg]:size-4 [&_svg]:shrink-0",
        tone === "destructive"
          ? "text-expense data-highlighted:bg-tint-rose"
          : "text-text",
        className,
      )}
      {...props}
    />
  );
}

function ContextMenuSeparator({
  className,
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.Separator>) {
  return (
    <ContextMenuPrimitive.Separator
      data-slot="context-menu-separator"
      className={cn("bg-hairline -mx-1 my-1 h-px", className)}
      {...props}
    />
  );
}

function ContextMenuLabel({
  className,
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.Label>) {
  return (
    <ContextMenuPrimitive.Label
      data-slot="context-menu-label"
      className={cn(
        "text-text-secondary text-xs truncate px-3 pt-2 pb-1 font-semibold ",
        className,
      )}
      {...props}
    />
  );
}

export {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
};
