"use client";

import { Check } from "lucide-react";

import { COLORS } from "@/lib/colors";
import { cn } from "@/lib/utils";

/** Swatch row. Each swatch is a 44px target with the colour inside it. */
export function ColorPicker({
  value,
  onChange,
  label = "Colour",
  className,
}: {
  value: string;
  onChange: (color: string) => void;
  label?: string;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn("flex flex-wrap gap-1", className)}
    >
      {COLORS.map((color) => {
        const active = color.toLowerCase() === value.toLowerCase();

        return (
          <button
            key={color}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={color}
            onClick={() => onChange(color)}
            className=" flex size-11 items-center justify-center rounded-lg "
          >
            <span
              className={cn(
                "flex size-7 items-center justify-center rounded-full transition-transform",
                active && "ring-foreground/60 scale-110 ring-2 ring-offset-2",
                "ring-offset-background",
              )}
              style={{ backgroundColor: color }}
            >
              {active ? (
                <Check className="size-4 text-white" aria-hidden="true" />
              ) : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}
