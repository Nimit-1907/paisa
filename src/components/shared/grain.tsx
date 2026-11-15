import { cn } from "@/lib/utils";

/**
 * A faint, fixed grain over a large surface.
 *
 * It is what stops a big flat panel reading as a hole in the page, and at
 * this opacity it registers as texture rather than as noise. Inline, so it
 * costs no request; `feTurbulence` with a fixed seed, so it is the same
 * grain every render and the visual baselines do not drift.
 *
 * Used on the month card, the landing hero and the signed-out screens —
 * the three places with enough empty surface to need it.
 */
export function Grain({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 size-full opacity-[0.035] dark:opacity-[0.05]",
        className,
      )}
    >
      <filter id="paisa-grain">
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.8"
          numOctaves="3"
          seed="7"
        />
      </filter>
      <rect width="100%" height="100%" filter="url(#paisa-grain)" />
    </svg>
  );
}
