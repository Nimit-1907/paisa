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
  tintClass,
  label = "Icon",
  className,
}: {
  value: string;
  onChange: (icon: IconName) => void;
  /**
   * The chosen tint, so the selected tile previews icon and colour at once.
   *
   * A `bg-tint-*` class, not a hex: Phase 14's eight tints are classes, and
   * a hex handed to an inline style could not follow the theme.
   */
  tintClass?: string;
  label?: string;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        "bg-surface-muted rounded-control grid max-h-44 grid-cols-6 gap-1 overflow-y-auto overscroll-contain p-2 sm:grid-cols-8",
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
              "rounded-control flex size-11 items-center justify-center transition-colors",
              active
                ? cn("text-text accent-sm", tintClass ?? "bg-tint-neutral")
                : "text-text-secondary hoverable:bg-surface hoverable:text-text",
            )}
          >
            <Icon className="size-5" aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}
