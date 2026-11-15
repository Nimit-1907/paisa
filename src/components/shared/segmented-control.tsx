"use client";

import { cn } from "@/lib/utils";

/**
 * Expense | Income | Transfer, and every other two-or-three-way choice.
 *
 * A muted track with one raised item in it. The selected item is the only
 * thing here allowed to be bold: surface fill, 1.5px ink border, and the
 * small hard shadow. The others are plain text on the track.
 *
 * The indicator is the selected item itself rather than a separate sliding
 * pill. A pill that slides *behind* three labels has to be measured against
 * them, and at 360px with "Transfer" in it that measurement is wrong often
 * enough to matter; moving the border with the selection cannot drift.
 * The 220ms the brief asks for is on the colour and shadow, which is what
 * is visible on a track this narrow.
 */
export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  label,
  className,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (next: T) => void;
  /** Names the group for a screen reader. */
  label: string;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        "bg-surface-muted rounded-control grid gap-1 p-1",
        className,
      )}
      style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}
    >
      {options.map((option) => {
        const active = option.value === value;

        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={cn(
              // 44px, not the 32 the reference draws. This is a control a
              // thumb hits on the screen it is used most (the add sheet),
              // and CLAUDE.md's floor is not negotiable against a mockup.
              "rounded-segment pressable flex h-11 items-center justify-center text-[13px] font-semibold",
              "duration-[220ms] transition-[background-color,box-shadow,border-color] motion-reduce:transition-none",
              active
                ? "bg-surface accent-sm text-text"
                : "text-text-secondary border border-transparent",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
