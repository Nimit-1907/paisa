"use client";

import * as React from "react";

import { Vibrate } from "lucide-react";
import { toast } from "sonner";

import { setHaptics } from "@/actions/profile";
import { haptic } from "@/lib/motion";
import { cn } from "@/lib/utils";

/**
 * "Haptic feedback", saved the moment it is switched.
 *
 * Its own card rather than part of the settings form, because it is the one
 * setting you judge by feel: flicking it on and getting a buzz is the whole
 * explanation, and that only works if it saves itself. A failed save puts the
 * switch back rather than leaving the screen claiming something untrue.
 */
export function HapticsCard({ enabled }: { enabled: boolean }) {
  const [on, setOn] = React.useState(enabled);
  const [saving, setSaving] = React.useState(false);

  async function toggle() {
    const next = !on;

    setOn(next);
    setSaving(true);
    // On the way on, not on the way off: a buzz confirming that buzzing is
    // now switched off would be a strange thing to feel.
    haptic(next);

    try {
      const result = await setHaptics(next);
      if (!result.ok) {
        setOn(!next);
        toast.error(result.error);
      }
    } catch (thrown) {
      console.error("[settings]", thrown);
      setOn(!next);
      toast.error("Could not save that. Check your connection.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="bg-card rounded-2xl border p-4">
      <label className="flex min-h-11 cursor-pointer items-start gap-3">
        <span className="bg-muted text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded-xl">
          <Vibrate className="size-5" aria-hidden="true" />
        </span>

        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">Haptic feedback</span>
          <span className="text-muted-foreground mt-0.5 block text-xs">
            A light buzz when a record is saved or deleted. Phones only —
            laptops and iPhones have no way to do it.
          </span>
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
    </section>
  );
}
