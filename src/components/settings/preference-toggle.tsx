"use client";

import * as React from "react";

import { Check, type LucideIcon } from "lucide-react";
import { toast } from "sonner";

import type { ActionResult } from "@/lib/action-result";
import { cn } from "@/lib/utils";

/** How long "Saved" stays up before fading out. */
const SAVED_FOR = 2000;

/**
 * A preference that saves itself the moment it is switched.
 *
 * These are the settings you judge by result rather than by reading: flick
 * haptics on and the buzz is the whole explanation; turn paise on and the
 * list behind you changes. A Save button between the switch and the effect
 * turns a one-second decision into a three-step errand.
 *
 * Two things that follow from saving instantly:
 *
 *  - **A failed save puts the switch back.** A toggle left in the position
 *    the server refused is a screen claiming something untrue, which is
 *    worse than the failure.
 *  - **It says "Saved".** Without it, an instant-save control is
 *    indistinguishable from one that does nothing, and the only way to find
 *    out is to leave and come back.
 */
export function PreferenceToggle({
  icon: Icon,
  label,
  description,
  enabled,
  onToggle,
  onOptimistic,
}: {
  icon: LucideIcon;
  label: string;
  description: string;
  enabled: boolean;
  onToggle: (next: boolean) => Promise<ActionResult<undefined>>;
  /** Fired as the switch moves, for a setting you feel rather than read. */
  onOptimistic?: (next: boolean) => void;
}) {
  const [on, setOn] = React.useState(enabled);
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);

  // Cleared on unmount, so a timer cannot set state on a gone component.
  const timer = React.useRef<number | null>(null);
  React.useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    [],
  );

  async function toggle() {
    const next = !on;

    setOn(next);
    setSaved(false);
    setSaving(true);
    onOptimistic?.(next);

    try {
      const result = await onToggle(next);

      if (!result.ok) {
        setOn(!next);
        toast.error(result.error);
        return;
      }

      setSaved(true);
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setSaved(false), SAVED_FOR);
    } catch (thrown) {
      console.error("[settings]", thrown);
      setOn(!next);
      toast.error("Could not save that. Check your connection.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <label className="flex min-h-11 cursor-pointer items-start gap-3">
      <span className="bg-surface-muted text-text-secondary rounded-control flex size-10 shrink-0 items-center justify-center">
        <Icon className="size-5" aria-hidden="true" />
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="text-sm font-semibold">{label}</span>

          {/*
            Polite, so it is announced after whatever the switch itself
            says rather than interrupting it, and it occupies no space when
            absent, a reserved slot would shift the row every time.
          */}
          <span
            role="status"
            className={cn(
              "text-income flex items-center gap-1 text-xs font-semibold",
              "duration-200 transition-opacity motion-reduce:transition-none",
              saved ? "opacity-100" : "opacity-0",
            )}
          >
            <Check className="size-3.5" aria-hidden="true" />
            {saved ? "Saved" : ""}
          </span>
        </span>

        <span className="text-text-secondary mt-0.5 block text-xs">{description}</span>
      </span>

      <input
        type="checkbox"
        role="switch"
        checked={on}
        disabled={saving}
        onChange={() => void toggle()}
        className={cn(
          "accent-primary mt-0.5 size-5 shrink-0 cursor-pointer",
          saving && "opacity-50",
        )}
      />
    </label>
  );
}
