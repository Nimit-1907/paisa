"use client";

import { Tile } from "@/components/shared/tile";
import { cn } from "@/lib/utils";

export type TileOption = {
  id: string;
  name: string;
  icon: string | null;
  tint: string | null;
};

/**
 * The four-column grid of tinted tiles: categories, accounts, icons, tints.
 *
 * One pattern for all four because they are the same question — "which of
 * these?" — and the reference answers it the same way every time: a tile, a
 * name under it, and an ink border with the small hard shadow on the one
 * that is chosen.
 *
 * The whole cell is the target, not the tile inside it, so the tap area is
 * the full column width rather than 38px of tile.
 */
export function TilePicker({
  options,
  value,
  onChange,
  label,
  columns = 4,
  multiple = false,
  className,
}: {
  options: TileOption[];
  /** The chosen id, or the chosen ids when `multiple`. */
  value: string | string[] | null;
  onChange: (id: string) => void;
  label: string;
  columns?: 3 | 4;
  /** Checkboxes rather than radios, for the filter sheet. */
  multiple?: boolean;
  className?: string;
}) {
  const chosen = (id: string) =>
    Array.isArray(value) ? value.includes(id) : value === id;

  return (
    <div
      role={multiple ? "group" : "radiogroup"}
      aria-label={label}
      className={cn(
        "grid gap-2",
        columns === 4 ? "grid-cols-4" : "grid-cols-3",
        className,
      )}
    >
      {options.map((option) => {
        const active = chosen(option.id);

        return (
          <button
            key={option.id}
            type="button"
            role={multiple ? "checkbox" : "radio"}
            aria-checked={active}
            onClick={() => onChange(option.id)}
            className={cn(
              "rounded-control pressable flex min-h-[72px] flex-col items-center justify-center gap-1.5 px-1 py-2",
              "duration-[120ms] transition-[border-color,box-shadow] motion-reduce:transition-none",
              active
                ? "accent-sm bg-surface"
                : "border border-transparent",
            )}
          >
            <Tile tint={option.tint} icon={option.icon} size="md" />
            <span className="text-text w-full truncate text-center text-[11px] font-medium">
              {option.name}
            </span>
          </button>
        );
      })}
    </div>
  );
}
