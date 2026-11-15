"use client";

import { Check } from "lucide-react";

import { passwordAdvice } from "@/lib/password-hints";
import { cn } from "@/lib/utils";

/**
 * What is required, and what would be better.
 *
 * A checklist rather than a strength bar. A bar answers "how good is this?"
 * with a number nobody can act on, and it turns choosing a password into a
 * score to beat. This says the one thing that is actually required, then
 * three things that help, under a heading that makes clear they are advice.
 *
 * Announced politely rather than assertively: a live region that interrupts
 * on every keystroke is unusable, and this is information to check rather
 * than a message to act on immediately.
 */
export function PasswordHints({ value }: { value: string }) {
  const { required, stronger } = passwordAdvice(value);

  // Nothing typed yet: the requirement alone, so the checklist does not land
  // as four unticked boxes the moment the field is focused.
  const started = value.length > 0;

  return (
    <div className="mt-2" aria-live="polite">
      <Hint hint={required} />

      {started ? (
        <>
          <p className="text-text-secondary mt-2 text-xs font-semibold">
            Stronger if it also:
          </p>
          <ul className="mt-1 space-y-1">
            {stronger.map((hint) => (
              <li key={hint.id}>
                <Hint hint={hint} />
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}

function Hint({ hint }: { hint: { label: string; met: boolean } }) {
  return (
    <p
      className={cn(
        "flex items-center gap-2 text-xs",
        hint.met ? "text-text" : "text-text-secondary",
      )}
    >
      {/* A mint tile with an ink tick when it is met, an empty ring when it
          is not. The tile is what makes a met rule readable at a glance in
          a list of four; the colour alone would not, and the sr-only words
          below carry it for anyone the colour is lost on. */}
      <span
        aria-hidden="true"
        className={cn(
          "flex size-4 shrink-0 items-center justify-center rounded-[5px]",
          hint.met ? "bg-tint-mint text-text" : "border-hairline border",
        )}
      >
        {hint.met ? <Check className="size-3" strokeWidth={3} /> : null}
      </span>
      {/* Said in words too: a tick is a colour and a shape, and neither is
          text a screen reader can read. */}
      <span className="sr-only">{hint.met ? "Done:" : "Not yet:"}</span>
      {hint.label}
    </p>
  );
}
