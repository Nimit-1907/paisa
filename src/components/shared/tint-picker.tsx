"use client";

import { Check } from "lucide-react";

import { TINT_BG, TINT_KEYS, type TintKey } from "@/lib/tokens";
import { cn } from "@/lib/utils";

/** What each tint is called out loud. The keys are not words. */
const TINT_LABELS: Record<TintKey, string> = {
  rose: "Rose",
  coral: "Coral",
  peach: "Peach",
  amber: "Amber",
  butter: "Butter",
  sand: "Sand",
  sage: "Sage",
  mint: "Mint",
  teal: "Teal",
  ice: "Ice",
  sky: "Sky",
  peri: "Periwinkle",
  lilac: "Lilac",
  plum: "Plum",
  slate: "Slate",
  neutral: "Neutral",
};
/**
 * Sixteen swatches, where there used to be a free colour wheel.
 *
 * The old picker let somebody choose a yellow that an icon disappeared on,
 * or two reds nobody could tell apart. These sixteen are checked against AA
 * on both themes by `src/lib/tokens.test.ts` before anything else runs,
 * which is a promise a hex from a form cannot make, and no two of them are
 * close enough to be mistaken for each other at this size.
 *
 * The chosen one takes the ink border and the small hard shadow, like every
 * other selected thing in this language, and a tick — because a border on a
 * pale square is a difference somebody may not see.
 */
export function TintPicker({
  value,
  onChange,
  label = "Colour",
  className,
}: {
  value: string;
  onChange: (tint: TintKey) => void;
  label?: string;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn("flex flex-wrap gap-1.5", className)}
    >
      {TINT_KEYS.map((tint) => {
        const active = tint === value;

        return (
          <button
            key={tint}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={TINT_LABELS[tint]}
            onClick={() => onChange(tint)}
            className={cn(
              "rounded-control pressable flex size-11 items-center justify-center",
              "duration-[120ms] transition-[box-shadow,border-color] motion-reduce:transition-none",
              TINT_BG[tint],
              active ? "accent-sm" : "border border-transparent",
            )}
          >
            {active ? (
              <Check className="text-text size-4" aria-hidden="true" />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
