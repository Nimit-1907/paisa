"use client";

import { Check, Circle } from "lucide-react";

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
      <Hint hint={required} required />

      {started ? (
        <>
          <p className="text-ink-3 mt-2 text-xs font-semibold">
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

function Hint({
  hint,
  required = false,
}: {
  hint: { label: string; met: boolean };
  required?: boolean;
}) {
  return (
    <p
      className={cn(
        "flex items-center gap-1.5 text-xs",
        hint.met ? "text-income" : required ? "text-ink-2" : "text-ink-3",
      )}
    >
      {hint.met ? (
        <Check className="size-3.5 shrink-0" aria-hidden="true" />
      ) : (
        <Circle className="size-3.5 shrink-0" aria-hidden="true" />
      )}
      {/* Said in words too: a tick is a colour and a shape, and neither is
          text a screen reader can read. */}
      <span className="sr-only">{hint.met ? "Done:" : "Not yet:"}</span>
      {hint.label}
    </p>
  );
}
