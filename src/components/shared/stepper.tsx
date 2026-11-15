"use client";

import { Minus, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * A small whole number, as two buttons and a figure.
 *
 * For "every 2 weeks" and nothing larger. A `type="number"` input here asks
 * for the on-screen number pad to set a value that is almost always 1, 2 or
 * 3 — and its native spinners are 12px tall, which is not a target. The
 * field stays underneath for a keyboard and a screen reader; the buttons are
 * what a thumb uses.
 */
export function Stepper({
  value,
  onChange,
  min = 1,
  max = 365,
  label,
  id,
  className,
}: {
  value: string;
  onChange: (next: string) => void;
  min?: number;
  max?: number;
  /** Names the field. The visible label sits above it. */
  label: string;
  id?: string;
  className?: string;
}) {
  const parsed = /^\d+$/.test(value.trim()) ? Number(value.trim()) : null;
  const step = (by: number) => {
    const from = parsed ?? min;
    onChange(String(Math.min(max, Math.max(min, from + by))));
  };

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Button
        type="button"
        variant="secondary"
        size="icon-touch"
        aria-label={`One less: ${label}`}
        disabled={parsed !== null && parsed <= min}
        onClick={() => step(-1)}
      >
        <Minus className="size-4" aria-hidden="true" />
      </Button>

      <input
        id={id}
        type="text"
        inputMode="numeric"
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="bg-surface rounded-control h-11 min-w-0 flex-1 border px-2 text-center text-base font-semibold tabular-nums focus-visible:border-ink md:text-sm"
      />

      <Button
        type="button"
        variant="secondary"
        size="icon-touch"
        aria-label={`One more: ${label}`}
        disabled={parsed !== null && parsed >= max}
        onClick={() => step(1)}
      >
        <Plus className="size-4" aria-hidden="true" />
      </Button>
    </div>
  );
}
