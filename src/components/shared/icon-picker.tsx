"use client";

import * as React from "react";

import { ICONS, ICON_NAMES, type IconName } from "@/lib/icons";
import { cn } from "@/lib/utils";

/**
 * Grid of icons to choose from.
 *
 * A radiogroup rather than a listbox: one of these is always chosen, arrow
 * keys move between them, and each tile is a 44px target. The grid scrolls
 * inside the sheet instead of pushing the save button off screen.
 */
export function IconPicker({
  value,
  onChange,
  color,
  label = "Icon",
  className,
}: {
  value: string;
  onChange: (icon: IconName) => void;
  /** Tints the selected tile, so icon and colour are previewed together. */
  color?: string;
  label?: string;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        "bg-muted/40 grid max-h-44 grid-cols-6 gap-1 overflow-y-auto overscroll-contain rounded-xl p-2 sm:grid-cols-8",
        className,
      )}
    >
      {ICON_NAMES.map((name) => {
        const Icon = ICONS[name];
        const active = name === value;

        return (
          <button
            key={name}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={name}
            onClick={() => onChange(name)}
            className={cn(
              "focus-visible:ring-ring flex size-11 items-center justify-center rounded-lg transition-colors focus-visible:ring-2 focus-visible:outline-none",
              active
                ? "text-white shadow-sm"
                : "text-muted-foreground hoverable:bg-background hoverable:text-foreground",
            )}
            style={active ? { backgroundColor: color ?? undefined } : undefined}
          >
            <Icon className="size-5" aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}
